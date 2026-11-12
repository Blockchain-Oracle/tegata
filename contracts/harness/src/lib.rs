//! A thin harness for the autopilot's tests: a local NEAR sandbox (near-sandbox 0.4), the NEP-141 reference token
//! standing in for USDC, a second token that must be refused, and the autopilot itself, driven with near-api 0.8.
//! Every account is created with the sandbox's genesis key, so one signer signs for all of them.

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use near_api::types::transaction::result::TransactionResult;
use near_api::{AccountId, Chain, Contract, NearGas, NearToken, NetworkConfig, Signer};
use near_sandbox::config::{DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY, DEFAULT_GENESIS_ACCOUNT_PUBLIC_KEY};
use near_sandbox::Sandbox;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

pub const USDC: u128 = 1_000_000;
/// NEAR the operator pays to register a business here (the contract refunds what it doesn't use to storage).
pub const REGISTER_NEAR: NearToken = NearToken::from_millinear(500);
/// NEP-141 storage for one account on the token.
const TOKEN_STORAGE: NearToken = NearToken::from_millinear(13);
pub const MAX_GAS: NearGas = NearGas::from_tgas(300);

/// What one transaction did: success or the failure text, the NEP-297 events and every log.
#[derive(Debug)]
pub struct Outcome {
    pub success: bool,
    pub failure: Option<String>,
    pub events: Vec<Value>,
    pub logs: Vec<String>,
    /// The call's JSON return value, when it returned one.
    pub value: Option<Value>,
}

impl Outcome {
    pub fn events_named(&self, name: &str) -> Vec<&Value> {
        self.events.iter().filter(|e| e["event"] == name).collect()
    }
    pub fn event(&self, name: &str) -> Option<&Value> {
        self.events.iter().find(|e| e["event"] == name)
    }
    #[track_caller]
    pub fn ok(self) -> Self {
        assert!(self.success, "expected success, got {:?}", self.failure);
        self
    }
    #[track_caller]
    pub fn failed_with(self, text: &str) -> Self {
        assert!(!self.success, "expected a failure containing {text:?}, but it succeeded");
        let failure = self.failure.clone().unwrap_or_default();
        assert!(failure.contains(text), "expected {text:?} in {failure}");
        self
    }
}

pub struct World {
    pub sandbox: Sandbox,
    pub network: NetworkConfig,
    pub signer: Arc<Signer>,
    pub usdc: AccountId,
    pub fake: AccountId,
    pub autopilot: AccountId,
    /// Tegata's operator: the contract's admin, the token's minter, and who pays businesses' storage.
    pub operator: AccountId,
}

pub fn wasm(name: &str) -> Result<Vec<u8>> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../target/near")
        .join(name)
        .join(format!("{name}.wasm"));
    std::fs::read(&path).with_context(|| {
        format!("missing {}; run `cargo near build non-reproducible-wasm` in the contract first", path.display())
    })
}

pub fn id(name: &str) -> AccountId {
    format!("{name}.sandbox").parse().expect("account id")
}

impl World {
    /// A fresh sandbox with the token, the refused token and the autopilot deployed and initialised.
    pub async fn start() -> Result<Self> {
        let sandbox = Sandbox::start_sandbox().await?;
        let network = NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse()?);
        let signer = Signer::from_secret_key(DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse()?)?;
        let world = Self {
            sandbox,
            network,
            signer,
            usdc: id("usdc"),
            fake: id("fake"),
            autopilot: id("autopilot"),
            operator: id("operator"),
        };
        for account in [&world.usdc, &world.fake, &world.autopilot, &world.operator] {
            world.account(account, NearToken::from_near(50)).await?;
        }
        world
            .deploy(&world.usdc, "tegata_test_token", json!({ "owner_id": world.operator, "total_supply": (1_000_000 * USDC).to_string() }))
            .await?;
        world
            .deploy(&world.fake, "tegata_test_token", json!({ "owner_id": world.operator, "total_supply": (1_000_000 * USDC).to_string() }))
            .await?;
        world
            .deploy(&world.autopilot, "tegata_autopilot", json!({ "token": world.usdc, "admin": world.operator }))
            .await?;
        world.register_on(&world.usdc, &world.autopilot).await?;
        world.register_on(&world.fake, &world.autopilot).await?;
        Ok(world)
    }

    /// Create an account signed by the shared genesis key.
    pub async fn account(&self, account: &AccountId, balance: NearToken) -> Result<()> {
        self.sandbox
            .create_account(account.as_str().parse()?)
            .initial_balance(balance)
            .public_key(DEFAULT_GENESIS_ACCOUNT_PUBLIC_KEY.to_string())
            .send()
            .await?;
        Ok(())
    }

    async fn deploy(&self, account: &AccountId, wasm_name: &str, init: Value) -> Result<()> {
        Contract::deploy(account.clone())
            .use_code(wasm(wasm_name)?)
            .with_init_call("new", init)?
            .with_signer(self.signer.clone())
            .send_to(&self.network)
            .await?
            .assert_success();
        Ok(())
    }

    /// Sign `method` on `contract` as `signer_id`.
    pub async fn call(
        &self,
        signer_id: &AccountId,
        contract: &AccountId,
        method: &str,
        args: Value,
        deposit: NearToken,
        gas: NearGas,
    ) -> Result<Outcome> {
        let result = Contract(contract.clone())
            .call_function_raw(method, serde_json::to_vec(&args)?)
            .transaction()
            .deposit(deposit)
            .gas(gas)
            .with_signer(signer_id.clone(), self.signer.clone())
            .send_to(&self.network)
            .await?;
        Ok(outcome(result))
    }

    pub async fn view<T: DeserializeOwned + Send + Sync>(&self, contract: &AccountId, method: &str, args: Value) -> Result<T> {
        Ok(Contract(contract.clone())
            .call_function(method, args)
            .read_only::<T>()
            .fetch_from(&self.network)
            .await?
            .data)
    }

    pub async fn register_on(&self, token: &AccountId, account: &AccountId) -> Result<()> {
        self.call(&self.operator, token, "storage_deposit", json!({ "account_id": account }), TOKEN_STORAGE, MAX_GAS)
            .await?
            .ok();
        Ok(())
    }

    pub async fn balance(&self, token: &AccountId, account: &AccountId) -> Result<u128> {
        let value: String = self.view(token, "ft_balance_of", json!({ "account_id": account })).await?;
        Ok(value.parse()?)
    }

    pub async fn near_balance(&self, account: &AccountId) -> Result<NearToken> {
        Ok(near_api::Tokens::account(account.clone()).near_balance().fetch_from(&self.network).await?.total)
    }

    /// Operator sends `amount` of a token to `to` (registering `to` first).
    pub async fn fund(&self, token: &AccountId, to: &AccountId, amount: u128) -> Result<()> {
        self.register_on(token, to).await?;
        self.call(
            &self.operator,
            token,
            "ft_transfer",
            json!({ "receiver_id": to, "amount": amount.to_string() }),
            NearToken::from_yoctonear(1),
            MAX_GAS,
        )
        .await?
        .ok();
        Ok(())
    }

    /// A business with its own account, registered here by the operator, holding `usdc` on the token.
    pub async fn business(&self, name: &str, usdc: u128) -> Result<AccountId> {
        let business = id(name);
        self.account(&business, NearToken::from_near(10)).await?;
        self.fund(&self.usdc, &business, usdc).await?;
        self.call(&self.operator, &self.autopilot, "storage_deposit", json!({ "account_id": business }), REGISTER_NEAR, MAX_GAS)
            .await?
            .ok();
        Ok(business)
    }

    /// A person to be paid: an account, optionally registered on the token.
    pub async fn person(&self, name: &str, registered: bool) -> Result<AccountId> {
        let person = id(name);
        self.account(&person, NearToken::from_near(2)).await?;
        if registered {
            self.register_on(&self.usdc, &person).await?;
        }
        Ok(person)
    }

    /// `ft_transfer_call` of `amount` from `from` to the autopilot.
    pub async fn deposit(&self, token: &AccountId, from: &AccountId, amount: u128, msg: &str) -> Result<Outcome> {
        self.call(
            from,
            token,
            "ft_transfer_call",
            json!({ "receiver_id": self.autopilot, "amount": amount.to_string(), "msg": msg }),
            NearToken::from_yoctonear(1),
            MAX_GAS,
        )
        .await
    }

    pub async fn business_view(&self, business: &AccountId) -> Result<Value> {
        self.view(&self.autopilot, "get_business", json!({ "account_id": business })).await
    }

    pub async fn plan(&self, plan_id: &str) -> Result<Value> {
        self.view(&self.autopilot, "get_plan", json!({ "plan_id": plan_id })).await
    }

    /// The chain's clock (milliseconds), from the latest block.
    pub async fn now_ms(&self) -> Result<u64> {
        let block = Chain::block().fetch_from(&self.network).await?;
        Ok(block.header.timestamp / 1_000_000)
    }

    /// Wait until the chain's clock passes `ms`.
    pub async fn until(&self, ms: u64) -> Result<()> {
        for _ in 0..120 {
            if self.now_ms().await? > ms {
                return Ok(());
            }
            self.sandbox.fast_forward(5).await?;
        }
        anyhow::bail!("the sandbox clock never reached {ms}")
    }

    pub async fn run(&self, caller: &AccountId, plan_id: &str, gas: NearGas) -> Result<Outcome> {
        self.call(caller, &self.autopilot, "run", json!({ "plan_id": plan_id }), NearToken::from_yoctonear(0), gas).await
    }
}

pub fn parse_events<'a>(logs: impl IntoIterator<Item = &'a str>) -> Vec<Value> {
    logs.into_iter()
        .filter_map(|log| log.strip_prefix("EVENT_JSON:"))
        .filter_map(|json| serde_json::from_str(json).ok())
        .collect()
}

fn outcome(result: TransactionResult) -> Outcome {
    let full = match result {
        TransactionResult::Full(full) => *full,
        TransactionResult::Pending { status } => {
            return Outcome {
                success: false,
                failure: Some(format!("pending: {status:?}")),
                events: vec![],
                logs: vec![],
                value: None,
            }
        }
    };
    let logs: Vec<String> = full.logs().into_iter().map(str::to_owned).collect();
    let events = parse_events(logs.iter().map(String::as_str));
    match full.into_result() {
        Ok(success) => {
            let value = success.json::<Value>().ok();
            Outcome { success: true, failure: None, events, logs, value }
        }
        Err(failure) => Outcome { success: false, failure: Some(format!("{failure:?}")), events, logs, value: None },
    }
}

/// Rows as the contract takes them.
pub fn rows(entries: &[(&AccountId, u128)]) -> Value {
    Value::Array(
        entries
            .iter()
            .map(|(account, amount)| json!({ "account_id": account, "amount": amount.to_string() }))
            .collect(),
    )
}
