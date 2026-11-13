//! Tegata autopilot: money a business sets aside here pays its payroll schedule with nobody online.
//!
//! One deployment per network, many businesses, one token (USDC, fixed at `new`). A business deposits with
//! `ft_transfer_call`, creates a plan (rows of NEAR accounts and amounts, plus exact due timestamps computed in the
//! app in the business's own time zone), and anyone may call `run` once a date has passed. A run reserves the whole
//! occurrence first, so the owner can't drain it halfway, then pays the rows in chunks of ten. Each row is confirmed
//! in `on_paid`: paid, or returned to the business's available balance. Nothing moves a plan's cursor or date index
//! back, so one date can never pay twice.

use near_sdk::{
    env, ext_contract,
    json_types::{U128, U64},
    near, require,
    store::LookupMap,
    AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue,
};

/// Rows in one plan.
pub const MAX_ROWS: usize = 100;
/// Plans per business.
pub const MAX_PLANS: usize = 10;
/// Due dates a plan can hold at once (five years of monthly paydays).
pub const MAX_DATES: usize = 60;
/// The smallest row: 0.01 USDC.
pub const MIN_ROW: u128 = 10_000;
/// The most one business can hold here: 10,000 USDC.
pub const MAX_PER_BUSINESS: u128 = 10_000_000_000;
/// The most the whole contract holds: 100,000 USDC.
pub const MAX_TOTAL: u128 = 100_000_000_000;
/// Rows paid by one `run` call.
pub const CHUNK: usize = 10;

const GAS_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_ON_PAID: Gas = Gas::from_tgas(8);
const GAS_RUN_BASE: Gas = Gas::from_tgas(20);
const GAS_ON_WITHDRAWN: Gas = Gas::from_tgas(8);
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
/// A callback only needs to know whether the transfer succeeded; `ft_transfer` returns nothing.
const RESULT_MAX_LEN: usize = 64;

#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

/// One business's money here. `available` can be withdrawn or reserved; `reserved` belongs to an occurrence that
/// has started; `in_flight` has been sent and awaits confirmation. Their sum is what the token holds for it.
#[near(serializers = [borsh])]
pub struct Business {
    available: u128,
    reserved: u128,
    in_flight: u128,
    /// NEAR (yocto) paid for this business's storage and not yet used.
    storage_balance: u128,
    /// Who paid for storage: freed storage goes back to them, never to the business.
    storage_payer: AccountId,
    plans: Vec<u64>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PlanStatus {
    Active,
    Paused,
    Finished,
}

#[near(serializers = [borsh])]
pub struct Plan {
    owner: AccountId,
    /// Due timestamps in milliseconds, strictly increasing.
    due: Vec<u64>,
    /// The next date to pay. Only ever moves forward.
    next: u32,
    /// The next row of the current occurrence (0 between occurrences). Only ever moves forward within one.
    cursor: u32,
    rows: u32,
    total: u128,
    status: PlanStatus,
    /// NEAR (yocto) this plan's storage cost; refunded to the storage payer on cancel.
    storage_cost: u128,
    /// Which occurrence the bitmaps describe, and its rows paid and failed.
    bits_for: Option<u32>,
    paid: Vec<u8>,
    failed: Vec<u8>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Row {
    pub account_id: AccountId,
    pub amount: U128,
}

#[near(event_json(standard = "tegata_autopilot"))]
pub enum Event {
    #[event_version("1.0.0")]
    Deposited { business: AccountId, amount: U128 },
    #[event_version("1.0.0")]
    Withdrawn { business: AccountId, amount: U128 },
    #[event_version("1.0.0")]
    WithdrawFailed { business: AccountId, amount: U128 },
    #[event_version("1.0.0")]
    PlanCreated { plan_id: U64, business: AccountId, rows: u32, total: U128, dates: u32 },
    #[event_version("1.0.0")]
    PlanPaused { plan_id: U64 },
    #[event_version("1.0.0")]
    PlanResumed { plan_id: U64, dropped_dates: u32 },
    #[event_version("1.0.0")]
    PlanCancelled { plan_id: U64, released: U128, storage_refund: U128 },
    #[event_version("1.0.0")]
    OccurrenceStarted { plan_id: U64, occurrence: u32, due_ms: U64, total: U128 },
    #[event_version("1.0.0")]
    PayoutPaid { plan_id: U64, occurrence: u32, row: u32, account_id: AccountId, amount: U128 },
    #[event_version("1.0.0")]
    PayoutFailed { plan_id: U64, occurrence: u32, row: u32, account_id: AccountId, amount: U128 },
    #[event_version("1.0.0")]
    OccurrenceCompleted { plan_id: U64, occurrence: u32 },
    #[event_version("1.0.0")]
    RunUnderfunded { plan_id: U64, occurrence: u32, needed: U128, available: U128 },
}

#[near(serializers = [json])]
pub struct BusinessView {
    pub available: U128,
    pub reserved: U128,
    pub in_flight: U128,
    pub storage_balance: U128,
    pub storage_payer: AccountId,
    pub plans: Vec<U64>,
}

#[near(serializers = [json])]
pub struct PlanView {
    pub plan_id: U64,
    pub owner: AccountId,
    pub status: PlanStatus,
    pub due: Vec<U64>,
    pub next: u32,
    pub cursor: u32,
    pub rows: u32,
    pub total: U128,
    pub storage_cost: U128,
    /// The occurrence the next three fields describe.
    pub last_occurrence: Option<u32>,
    pub last_paid: u32,
    pub last_failed: u32,
}

#[near(serializers = [json])]
pub struct ConfigView {
    pub token: AccountId,
    pub admin: AccountId,
    pub paused: bool,
    /// What the token contract holds for every business together.
    pub total: U128,
    pub next_plan_id: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Autopilot {
    token: AccountId,
    admin: AccountId,
    paused: bool,
    total: u128,
    next_plan_id: u64,
    businesses: LookupMap<AccountId, Business>,
    plans: LookupMap<u64, Plan>,
    /// Rows in chunks of `CHUNK`, so a run loads only the ones it pays.
    rows: LookupMap<(u64, u32), Vec<Row>>,
}

#[near]
impl Autopilot {
    #[init]
    pub fn new(token: AccountId, admin: AccountId) -> Self {
        Self {
            token,
            admin,
            paused: false,
            total: 0,
            next_plan_id: 1,
            businesses: LookupMap::new(b"b"),
            plans: LookupMap::new(b"p"),
            rows: LookupMap::new(b"r"),
        }
    }

    // --- storage (NEAR, paid by the operator in its own transaction) ------------------------------------------

    /// Register a business (or top up its storage). The caller pays and becomes the storage payer.
    #[payable]
    pub fn storage_deposit(&mut self, account_id: AccountId) -> BusinessView {
        require!(!self.paused, "Paused");
        let amount = env::attached_deposit().as_yoctonear();
        if let Some(business) = self.businesses.get_mut(&account_id) {
            business.storage_balance += amount;
        } else {
            let before = env::storage_usage();
            self.businesses.insert(
                account_id.clone(),
                Business {
                    available: 0,
                    reserved: 0,
                    in_flight: 0,
                    storage_balance: 0,
                    storage_payer: env::predecessor_account_id(),
                    plans: Vec::new(),
                },
            );
            self.businesses.flush();
            let cost = storage_cost(before);
            require!(amount >= cost, "Attach enough NEAR to register");
            self.business_mut(&account_id).storage_balance = amount - cost;
        }
        self.get_business(account_id).expect("registered")
    }

    // --- money in and out ----------------------------------------------------------------------------------------

    /// USDC arriving with `ft_transfer_call`. Anything this contract can't credit is returned in full.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(env::predecessor_account_id() == self.token, "Only USDC");
        let refused = !msg.is_empty()
            || self.paused
            || self.total + amount.0 > MAX_TOTAL
            || match self.businesses.get(&sender_id) {
                None => true,
                Some(b) => b.available + b.reserved + b.in_flight + amount.0 > MAX_PER_BUSINESS,
            };
        if refused {
            return PromiseOrValue::Value(amount);
        }
        self.business_mut(&sender_id).available += amount.0;
        self.total += amount.0;
        Event::Deposited { business: sender_id, amount }.emit();
        PromiseOrValue::Value(U128(0))
    }

    /// Take available USDC back. Debited first; re-credited if the transfer fails. Never blocked by pause.
    #[payable]
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        near_sdk::assert_one_yocto();
        let owner = env::predecessor_account_id();
        let business = self.business_mut(&owner);
        require!(amount.0 > 0, "Nothing to withdraw");
        require!(business.available >= amount.0, "More than is available");
        business.available -= amount.0;
        self.total -= amount.0;
        ext_ft::ext(self.token.clone())
            .with_static_gas(GAS_TRANSFER)
            .with_attached_deposit(ONE_YOCTO)
            .with_unused_gas_weight(0)
            .ft_transfer(owner.clone(), amount, Some("tegata:autopilot:withdraw".into()))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_ON_WITHDRAWN)
                    .with_unused_gas_weight(0)
                    .on_withdrawn(owner, amount),
            )
    }

    #[private]
    pub fn on_withdrawn(&mut self, business: AccountId, amount: U128) {
        if env::promise_result_checked(0, RESULT_MAX_LEN).is_ok() {
            Event::Withdrawn { business, amount }.emit();
        } else if let Some(b) = self.businesses.get_mut(&business) {
            b.available += amount.0;
            self.total += amount.0;
            Event::WithdrawFailed { business, amount }.emit();
        }
    }

    // --- plans (the business's own calls) ------------------------------------------------------------------------

    /// A schedule: who is paid how much, on which dates (milliseconds, in the future, increasing).
    pub fn create_plan(&mut self, rows: Vec<Row>, due: Vec<U64>) -> U64 {
        require!(!self.paused, "Paused");
        let owner = env::predecessor_account_id();
        require!(self.businesses.contains_key(&owner), "Register first");
        require!(
            self.businesses.get(&owner).expect("registered").plans.len() < MAX_PLANS,
            "Too many plans"
        );
        require!(!rows.is_empty() && rows.len() <= MAX_ROWS, "1 to 100 rows");
        let mut total: u128 = 0;
        for row in &rows {
            require!(row.amount.0 >= MIN_ROW, "Each row is at least 0.01");
            total = total.checked_add(row.amount.0).expect("Total too large");
        }
        require!(total <= MAX_PER_BUSINESS, "Total too large");
        let due = valid_dates(&due, None);

        let before = env::storage_usage();
        let plan_id = self.next_plan_id;
        self.next_plan_id += 1;
        for (i, chunk) in rows.chunks(CHUNK).enumerate() {
            self.rows.insert((plan_id, i as u32), chunk.to_vec());
        }
        let count = rows.len() as u32;
        let dates = due.len() as u32;
        self.plans.insert(
            plan_id,
            Plan {
                owner: owner.clone(),
                due,
                next: 0,
                cursor: 0,
                rows: count,
                total,
                status: PlanStatus::Active,
                storage_cost: 0,
                bits_for: None,
                paid: Vec::new(),
                failed: Vec::new(),
            },
        );
        self.business_mut(&owner).plans.push(plan_id);
        self.flush();
        let cost = self.charge_storage(&owner, before);
        self.plan_mut(plan_id).storage_cost = cost;
        Event::PlanCreated { plan_id: U64(plan_id), business: owner, rows: count, total: U128(total), dates }
            .emit();
        U64(plan_id)
    }

    /// Add later dates to a plan.
    pub fn extend_plan(&mut self, plan_id: U64, due: Vec<U64>) {
        require!(!self.paused, "Paused");
        let owner = self.assert_plan_owner(plan_id.0);
        let plan = self.plans.get(&plan_id.0).expect("plan");
        let last = plan.due.last().copied();
        require!(plan.due.len() + due.len() <= MAX_DATES, "Too many dates");
        let due = valid_dates(&due, last);
        let before = env::storage_usage();
        let plan = self.plan_mut(plan_id.0);
        plan.due.extend(due);
        if plan.status == PlanStatus::Finished {
            plan.status = PlanStatus::Active;
        }
        self.flush();
        let cost = self.charge_storage(&owner, before);
        self.plan_mut(plan_id.0).storage_cost += cost;
    }

    pub fn pause_plan(&mut self, plan_id: U64) {
        self.assert_plan_owner(plan_id.0);
        let plan = self.plan_mut(plan_id.0);
        require!(plan.status == PlanStatus::Active, "Not active");
        plan.status = PlanStatus::Paused;
        Event::PlanPaused { plan_id }.emit();
    }

    /// Resume a paused plan. Dates that passed while it was paused are dropped, not paid late.
    pub fn resume_plan(&mut self, plan_id: U64) {
        self.assert_plan_owner(plan_id.0);
        let now = env::block_timestamp_ms();
        let plan = self.plan_mut(plan_id.0);
        require!(plan.status == PlanStatus::Paused, "Not paused");
        let mut dropped = 0;
        if plan.cursor == 0 {
            while (plan.next as usize) < plan.due.len() && plan.due[plan.next as usize] <= now {
                plan.next += 1;
                dropped += 1;
            }
        }
        plan.status = if (plan.next as usize) < plan.due.len() || plan.cursor > 0 {
            PlanStatus::Active
        } else {
            PlanStatus::Finished
        };
        Event::PlanResumed { plan_id, dropped_dates: dropped }.emit();
    }

    /// Cancel a plan: what it reserved and hasn't sent goes back to available; its storage goes back to the payer.
    pub fn cancel_plan(&mut self, plan_id: U64) {
        let owner = self.assert_plan_owner(plan_id.0);
        let plan = self.plans.get(&plan_id.0).expect("plan");
        let (cursor, rows, storage) = (plan.cursor, plan.rows, plan.storage_cost);
        let mut released: u128 = 0;
        if cursor > 0 {
            for index in cursor..rows {
                released += self.row(plan_id.0, index).amount.0;
            }
        }
        let before = env::storage_usage();
        for chunk in 0..rows.div_ceil(CHUNK as u32) {
            self.rows.remove(&(plan_id.0, chunk));
        }
        self.plans.remove(&plan_id.0);
        let business = self.business_mut(&owner);
        business.plans.retain(|id| *id != plan_id.0);
        business.reserved -= released;
        business.available += released;
        let payer = business.storage_payer.clone();
        self.flush();
        let freed = u128::from(before.saturating_sub(env::storage_usage()))
            * env::storage_byte_cost().as_yoctonear();
        let refund = freed.min(storage);
        if refund > 0 {
            Promise::new(payer).transfer(NearToken::from_yoctonear(refund)).detach();
        }
        Event::PlanCancelled { plan_id, released: U128(released), storage_refund: U128(refund) }.emit();
    }

    // --- the run (anyone, once a date has passed) ----------------------------------------------------------------

    /// Pay the next chunk of the plan's current occurrence. The first chunk reserves the whole occurrence, or, if
    /// the business can't cover it, emits `run_underfunded` and changes nothing (the date stays due).
    pub fn run(&mut self, plan_id: U64) {
        require!(!self.paused, "Paused");
        let now = env::block_timestamp_ms();
        let id = plan_id.0;
        let plan = self.plans.get(&id).expect("No such plan");
        require!(plan.status == PlanStatus::Active, "Plan isn't active");
        require!((plan.next as usize) < plan.due.len(), "Nothing left to pay");
        let due_ms = plan.due[plan.next as usize];
        require!(due_ms <= now, "Not due yet");
        let (occurrence, cursor, rows, total, owner) =
            (plan.next, plan.cursor, plan.rows, plan.total, plan.owner.clone());
        let count = (rows - cursor).min(CHUNK as u32);
        // Not enough gas for every row in this chunk: refuse up front, so the call reverts whole.
        let needed = GAS_RUN_BASE.as_gas()
            + u64::from(count) * (GAS_TRANSFER.as_gas() + GAS_ON_PAID.as_gas());
        require!(env::prepaid_gas().as_gas() >= needed, "Attach more gas");

        if cursor == 0 {
            let available = self.businesses.get(&owner).expect("business").available;
            if available < total {
                Event::RunUnderfunded {
                    plan_id,
                    occurrence,
                    needed: U128(total),
                    available: U128(available),
                }
                .emit();
                return;
            }
            let business = self.business_mut(&owner);
            business.available -= total;
            business.reserved += total;
            let bytes = (rows as usize).div_ceil(8);
            let plan = self.plan_mut(id);
            plan.bits_for = Some(occurrence);
            plan.paid = vec![0; bytes];
            plan.failed = vec![0; bytes];
            Event::OccurrenceStarted { plan_id, occurrence, due_ms: U64(due_ms), total: U128(total) }
                .emit();
        }

        let chunk = self.rows.get(&(id, cursor / CHUNK as u32)).expect("rows").clone();
        let mut sent: u128 = 0;
        for (i, row) in chunk.iter().enumerate() {
            let index = cursor + i as u32;
            sent += row.amount.0;
            ext_ft::ext(self.token.clone())
                .with_static_gas(GAS_TRANSFER)
                .with_attached_deposit(ONE_YOCTO)
                .with_unused_gas_weight(0)
                .ft_transfer(
                    row.account_id.clone(),
                    row.amount,
                    Some(format!("tegata:autopilot:{id}:{occurrence}:{index}")),
                )
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(GAS_ON_PAID)
                        .with_unused_gas_weight(0)
                        .on_paid(owner.clone(), plan_id, occurrence, index, row.account_id.clone(), row.amount),
                )
                .detach();
        }
        let business = self.business_mut(&owner);
        business.reserved -= sent;
        business.in_flight += sent;

        let plan = self.plan_mut(id);
        plan.cursor += count;
        if plan.cursor >= plan.rows {
            plan.cursor = 0;
            plan.next += 1;
            if plan.next as usize >= plan.due.len() {
                plan.status = PlanStatus::Finished;
            }
            Event::OccurrenceCompleted { plan_id, occurrence }.emit();
        }
    }

    /// One row's transfer, final: paid, or its money back in the business's available balance. Never panics.
    #[private]
    pub fn on_paid(
        &mut self,
        business: AccountId,
        plan_id: U64,
        occurrence: u32,
        row: u32,
        account_id: AccountId,
        amount: U128,
    ) {
        let ok = env::promise_result_checked(0, RESULT_MAX_LEN).is_ok();
        if let Some(b) = self.businesses.get_mut(&business) {
            b.in_flight = b.in_flight.saturating_sub(amount.0);
            if ok {
                self.total = self.total.saturating_sub(amount.0);
            } else {
                b.available += amount.0;
            }
        }
        if let Some(plan) = self.plans.get_mut(&plan_id.0) {
            if plan.bits_for == Some(occurrence) {
                let bits = if ok { &mut plan.paid } else { &mut plan.failed };
                if let Some(byte) = bits.get_mut(row as usize / 8) {
                    *byte |= 1 << (row % 8);
                }
            }
        }
        if ok {
            Event::PayoutPaid { plan_id, occurrence, row, account_id, amount }.emit();
        } else {
            Event::PayoutFailed { plan_id, occurrence, row, account_id, amount }.emit();
        }
    }

    // --- admin -------------------------------------------------------------------------------------------------------

    /// Stops deposits, new plans and runs. Never stops a withdrawal or a cancel.
    #[payable]
    pub fn pause(&mut self) {
        near_sdk::assert_one_yocto();
        require!(env::predecessor_account_id() == self.admin, "Admin only");
        self.paused = true;
    }

    #[payable]
    pub fn unpause(&mut self) {
        near_sdk::assert_one_yocto();
        require!(env::predecessor_account_id() == self.admin, "Admin only");
        self.paused = false;
    }

    // --- views -------------------------------------------------------------------------------------------------------

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            token: self.token.clone(),
            admin: self.admin.clone(),
            paused: self.paused,
            total: U128(self.total),
            next_plan_id: U64(self.next_plan_id),
        }
    }

    pub fn get_business(&self, account_id: AccountId) -> Option<BusinessView> {
        self.businesses.get(&account_id).map(|b| BusinessView {
            available: U128(b.available),
            reserved: U128(b.reserved),
            in_flight: U128(b.in_flight),
            storage_balance: U128(b.storage_balance),
            storage_payer: b.storage_payer.clone(),
            plans: b.plans.iter().map(|id| U64(*id)).collect(),
        })
    }

    pub fn get_plan(&self, plan_id: U64) -> Option<PlanView> {
        self.plans.get(&plan_id.0).map(|p| PlanView {
            plan_id,
            owner: p.owner.clone(),
            status: p.status,
            due: p.due.iter().map(|d| U64(*d)).collect(),
            next: p.next,
            cursor: p.cursor,
            rows: p.rows,
            total: U128(p.total),
            storage_cost: U128(p.storage_cost),
            last_occurrence: p.bits_for,
            last_paid: p.paid.iter().map(|b| b.count_ones()).sum(),
            last_failed: p.failed.iter().map(|b| b.count_ones()).sum(),
        })
    }

    pub fn get_rows(&self, plan_id: U64) -> Vec<Row> {
        let Some(plan) = self.plans.get(&plan_id.0) else { return Vec::new() };
        (0..plan.rows.div_ceil(CHUNK as u32))
            .flat_map(|chunk| self.rows.get(&(plan_id.0, chunk)).cloned().unwrap_or_default())
            .collect()
    }
}

impl Autopilot {
    fn business_mut(&mut self, account_id: &AccountId) -> &mut Business {
        self.businesses.get_mut(account_id).unwrap_or_else(|| env::panic_str("Register first"))
    }

    fn plan_mut(&mut self, plan_id: u64) -> &mut Plan {
        self.plans.get_mut(&plan_id).unwrap_or_else(|| env::panic_str("No such plan"))
    }

    fn row(&self, plan_id: u64, index: u32) -> &Row {
        let chunk = self.rows.get(&(plan_id, index / CHUNK as u32)).expect("rows");
        &chunk[(index % CHUNK as u32) as usize]
    }

    fn assert_plan_owner(&self, plan_id: u64) -> AccountId {
        let plan = self.plans.get(&plan_id).unwrap_or_else(|| env::panic_str("No such plan"));
        require!(plan.owner == env::predecessor_account_id(), "Not your plan");
        plan.owner.clone()
    }

    fn flush(&mut self) {
        self.businesses.flush();
        self.plans.flush();
        self.rows.flush();
    }

    /// Charge the storage added since `before` to the business's storage balance.
    fn charge_storage(&mut self, owner: &AccountId, before: u64) -> u128 {
        let cost = storage_cost(before);
        let business = self.business_mut(owner);
        require!(business.storage_balance >= cost, "Not enough storage paid for this plan");
        business.storage_balance -= cost;
        cost
    }
}

fn storage_cost(before: u64) -> u128 {
    u128::from(env::storage_usage().saturating_sub(before)) * env::storage_byte_cost().as_yoctonear()
}

/// Dates in the future, strictly increasing, after `after` when extending.
fn valid_dates(due: &[U64], after: Option<u64>) -> Vec<u64> {
    require!(!due.is_empty() && due.len() <= MAX_DATES, "1 to 60 dates");
    let now = env::block_timestamp_ms();
    let mut last = after.unwrap_or(0).max(now);
    for date in due {
        require!(date.0 > last, "Dates must be in the future and increasing");
        last = date.0;
    }
    due.iter().map(|d| d.0).collect()
}
