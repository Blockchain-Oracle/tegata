//! The autopilot's twelve tests, each on its own local sandbox with a real NEP-141 token.
//! Run: `cargo near build non-reproducible-wasm` in `autopilot` and `test-token`, then `cargo test -p tegata-autopilot-harness`.

use anyhow::Result;
use near_api::{NearGas, NearToken};
use serde_json::{json, Value};
use tegata_autopilot_harness::{id, rows, World, MAX_GAS, USDC};

const ZERO: NearToken = NearToken::from_yoctonear(0);
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
/// Far enough ahead that a test's own setup can't pass it.
const SOON_MS: u64 = 4_000;

fn u128_of(value: &Value) -> u128 {
    value.as_str().expect("a U128 string").parse().expect("a number")
}

async fn create_plan(w: &World, business: &near_api::AccountId, rows: Value, due: &[u64]) -> Result<String> {
    let due: Vec<String> = due.iter().map(u64::to_string).collect();
    let out = w
        .call(business, &w.autopilot, "create_plan", json!({ "rows": rows, "due": due }), ZERO, MAX_GAS)
        .await?
        .ok();
    Ok(out.value.and_then(|v| v.as_str().map(str::to_owned)).expect("plan id"))
}

async fn totals_match(w: &World, businesses: &[&near_api::AccountId]) -> Result<()> {
    let held = w.balance(&w.usdc, &w.autopilot).await?;
    let mut sum = 0;
    for business in businesses {
        let b = w.business_view(business).await?;
        sum += u128_of(&b["available"]) + u128_of(&b["reserved"]) + u128_of(&b["in_flight"]);
    }
    let config: Value = w.view(&w.autopilot, "get_config", json!({})).await?;
    assert_eq!(held, sum, "the token's balance equals what the businesses hold here");
    assert_eq!(held, u128_of(&config["total"]), "the contract's own total agrees");
    Ok(())
}

/// 1. Only USDC can be deposited: another token's `ft_transfer_call` is refused and its tokens go back.
#[tokio::test]
async fn deposit_only_from_usdc() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    w.fund(&w.fake, &studio, 50 * USDC).await?;
    w.deposit(&w.fake, &studio, 50 * USDC, "").await?;
    assert_eq!(w.balance(&w.fake, &studio).await?, 50 * USDC, "the other token came back");
    assert_eq!(w.balance(&w.fake, &w.autopilot).await?, 0);
    assert_eq!(u128_of(&w.business_view(&studio).await?["available"]), 0);

    let out = w.deposit(&w.usdc, &studio, 40 * USDC, "").await?.ok();
    assert!(out.event("deposited").is_some());
    assert_eq!(u128_of(&w.business_view(&studio).await?["available"]), 40 * USDC);
    Ok(())
}

/// 2. A deposit from an account that isn't registered here (or that carries a message) is returned in full.
#[tokio::test]
async fn unregistered_deposit_refunded() -> Result<()> {
    let w = World::start().await?;
    let stranger = id("stranger");
    w.account(&stranger, NearToken::from_near(5)).await?;
    w.fund(&w.usdc, &stranger, 30 * USDC).await?;
    w.deposit(&w.usdc, &stranger, 30 * USDC, "").await?;
    assert_eq!(w.balance(&w.usdc, &stranger).await?, 30 * USDC);
    assert!(w.business_view(&stranger).await?.is_null());

    let studio = w.business("studio", 30 * USDC).await?;
    w.deposit(&w.usdc, &studio, 30 * USDC, "not empty").await?;
    assert_eq!(w.balance(&w.usdc, &studio).await?, 30 * USDC, "a message means refuse");
    assert_eq!(w.balance(&w.usdc, &w.autopilot).await?, 0);
    Ok(())
}

/// 3. Running before the date changes nothing.
#[tokio::test]
async fn run_before_due_changes_nothing() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let mei = w.person("mei", true).await?;
    w.deposit(&w.usdc, &studio, 100 * USDC, "").await?.ok();
    let due = w.now_ms().await? + 600_000;
    let plan = create_plan(&w, &studio, rows(&[(&mei, 10 * USDC)]), &[due]).await?;

    w.run(&w.operator, &plan, MAX_GAS).await?.failed_with("Not due yet");
    let p = w.plan(&plan).await?;
    assert_eq!(p["next"], 0);
    assert_eq!(p["cursor"], 0);
    assert_eq!(u128_of(&w.business_view(&studio).await?["available"]), 100 * USDC);
    assert_eq!(w.balance(&w.usdc, &mei).await?, 0);
    Ok(())
}

/// 4. Each row is paid exactly once, even when two keepers run the same date at the same moment.
#[tokio::test]
async fn each_row_paid_once_under_concurrent_runs() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let (mei, kofi, sara) = (w.person("mei", true).await?, w.person("kofi", true).await?, w.person("sara", true).await?);
    let keeper = id("keeper");
    w.account(&keeper, NearToken::from_near(5)).await?;
    w.deposit(&w.usdc, &studio, 100 * USDC, "").await?.ok();
    let due = w.now_ms().await? + SOON_MS;
    let plan = create_plan(&w, &studio, rows(&[(&mei, 5 * USDC), (&kofi, 3 * USDC), (&sara, 2 * USDC)]), &[due]).await?;
    w.until(due).await?;

    let (a, b) = tokio::join!(w.run(&w.operator, &plan, MAX_GAS), w.run(&keeper, &plan, MAX_GAS));
    let (a, b) = (a?, b?);
    assert!(a.success != b.success, "exactly one run pays: {:?} / {:?}", a.failure, b.failure);
    let paid = if a.success { &a } else { &b };
    assert_eq!(paid.events_named("payout_paid").len(), 3);
    assert_eq!(w.balance(&w.usdc, &mei).await?, 5 * USDC);
    assert_eq!(w.balance(&w.usdc, &kofi).await?, 3 * USDC);
    assert_eq!(w.balance(&w.usdc, &sara).await?, 2 * USDC);

    w.run(&w.operator, &plan, MAX_GAS).await?.failed_with("Plan isn't active");
    assert_eq!(w.balance(&w.usdc, &mei).await?, 5 * USDC, "never twice");
    assert_eq!(w.plan(&plan).await?["status"], "Finished");
    Ok(())
}

/// 5. A row that can't be paid comes back to the business while the others are paid.
#[tokio::test]
async fn bad_row_refunded_while_others_paid() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let mei = w.person("mei", true).await?;
    let ghost = w.person("ghost", false).await?;
    let kofi = w.person("kofi", true).await?;
    w.deposit(&w.usdc, &studio, 20 * USDC, "").await?.ok();
    let due = w.now_ms().await? + SOON_MS;
    let plan = create_plan(&w, &studio, rows(&[(&mei, 5 * USDC), (&ghost, 4 * USDC), (&kofi, 3 * USDC)]), &[due]).await?;
    w.until(due).await?;

    let out = w.run(&w.operator, &plan, MAX_GAS).await?.ok();
    assert_eq!(out.events_named("payout_paid").len(), 2);
    let failed = out.events_named("payout_failed");
    assert_eq!(failed.len(), 1);
    assert_eq!(failed[0]["data"]["account_id"], ghost.to_string());
    assert_eq!(w.balance(&w.usdc, &mei).await?, 5 * USDC);
    assert_eq!(w.balance(&w.usdc, &kofi).await?, 3 * USDC);
    let b = w.business_view(&studio).await?;
    assert_eq!(u128_of(&b["available"]), 12 * USDC, "20 − 5 − 3: the unpaid 4 came back");
    assert_eq!(u128_of(&b["in_flight"]), 0);
    let p = w.plan(&plan).await?;
    assert_eq!(p["last_paid"], 2);
    assert_eq!(p["last_failed"], 1);
    Ok(())
}

/// 6. Conservation: the token's balance here always equals available + reserved + in flight, across businesses.
#[tokio::test]
async fn conservation_across_businesses() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let shop = w.business("shop", 100 * USDC).await?;
    let mei = w.person("mei", true).await?;
    let ghost = w.person("ghost", false).await?;
    w.deposit(&w.usdc, &studio, 60 * USDC, "").await?.ok();
    w.deposit(&w.usdc, &shop, 25 * USDC, "").await?.ok();
    totals_match(&w, &[&studio, &shop]).await?;

    let due = w.now_ms().await? + SOON_MS;
    let plan = create_plan(&w, &studio, rows(&[(&mei, 7 * USDC), (&ghost, 6 * USDC)]), &[due]).await?;
    w.until(due).await?;
    w.run(&w.operator, &plan, MAX_GAS).await?.ok();
    totals_match(&w, &[&studio, &shop]).await?;

    w.call(&shop, &w.autopilot, "withdraw", json!({ "amount": (10 * USDC).to_string() }), ONE_YOCTO, MAX_GAS)
        .await?
        .ok();
    totals_match(&w, &[&studio, &shop]).await?;
    assert_eq!(w.balance(&w.usdc, &w.autopilot).await?, 60 * USDC - 7 * USDC + 15 * USDC);
    Ok(())
}

/// 7. While an occurrence is part paid, what it reserved can't be withdrawn.
#[tokio::test]
async fn withdraw_cannot_touch_reserved() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 200 * USDC).await?;
    let mut people = Vec::new();
    for i in 0..12 {
        people.push(w.person(&format!("p{i}"), true).await?);
    }
    let entries: Vec<_> = people.iter().map(|p| (p, USDC)).collect();
    w.deposit(&w.usdc, &studio, 15 * USDC, "").await?.ok();
    let due = w.now_ms().await? + SOON_MS;
    let plan = create_plan(&w, &studio, rows(&entries), &[due]).await?;
    w.until(due).await?;

    w.run(&w.operator, &plan, MAX_GAS).await?.ok();
    let p = w.plan(&plan).await?;
    assert_eq!(p["cursor"], 10, "the first chunk paid ten");
    let b = w.business_view(&studio).await?;
    assert_eq!(u128_of(&b["reserved"]), 2 * USDC);
    assert_eq!(u128_of(&b["available"]), 3 * USDC);

    w.call(&studio, &w.autopilot, "withdraw", json!({ "amount": (4 * USDC).to_string() }), ONE_YOCTO, MAX_GAS)
        .await?
        .failed_with("More than is available");
    w.call(&studio, &w.autopilot, "withdraw", json!({ "amount": (3 * USDC).to_string() }), ONE_YOCTO, MAX_GAS)
        .await?
        .ok();
    w.run(&w.operator, &plan, MAX_GAS).await?.ok();
    for person in &people {
        assert_eq!(w.balance(&w.usdc, person).await?, USDC);
    }
    assert_eq!(u128_of(&w.business_view(&studio).await?["reserved"]), 0);
    Ok(())
}

/// 8. An underfunded run sends nothing, says so, and the date stays due until it's covered.
#[tokio::test]
async fn underfunded_run_sends_nothing_and_stays_due() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let mei = w.person("mei", true).await?;
    w.deposit(&w.usdc, &studio, 5 * USDC, "").await?.ok();
    let due = w.now_ms().await? + SOON_MS;
    let plan = create_plan(&w, &studio, rows(&[(&mei, 8 * USDC)]), &[due]).await?;
    w.until(due).await?;

    let out = w.run(&w.operator, &plan, MAX_GAS).await?.ok();
    let event = out.event("run_underfunded").expect("run_underfunded");
    assert_eq!(u128_of(&event["data"]["needed"]), 8 * USDC);
    assert_eq!(w.balance(&w.usdc, &mei).await?, 0);
    assert_eq!(w.plan(&plan).await?["next"], 0);
    assert_eq!(u128_of(&w.business_view(&studio).await?["available"]), 5 * USDC);

    w.deposit(&w.usdc, &studio, 3 * USDC, "").await?.ok();
    w.run(&w.operator, &plan, MAX_GAS).await?.ok();
    assert_eq!(w.balance(&w.usdc, &mei).await?, 8 * USDC);
    Ok(())
}

/// 9. A run without enough gas for its whole chunk reverts whole: nothing reserved, nothing sent.
#[tokio::test]
async fn low_gas_run_reverts_whole() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let (mei, kofi, sara) = (w.person("mei", true).await?, w.person("kofi", true).await?, w.person("sara", true).await?);
    w.deposit(&w.usdc, &studio, 30 * USDC, "").await?.ok();
    let due = w.now_ms().await? + SOON_MS;
    let plan = create_plan(&w, &studio, rows(&[(&mei, USDC), (&kofi, USDC), (&sara, USDC)]), &[due]).await?;
    w.until(due).await?;

    w.run(&w.operator, &plan, NearGas::from_tgas(40)).await?.failed_with("Attach more gas");
    let b = w.business_view(&studio).await?;
    assert_eq!(u128_of(&b["available"]), 30 * USDC);
    assert_eq!(u128_of(&b["reserved"]), 0);
    assert_eq!(w.plan(&plan).await?["next"], 0);
    assert_eq!(w.balance(&w.usdc, &mei).await?, 0);
    w.run(&w.operator, &plan, MAX_GAS).await?.ok();
    assert_eq!(w.balance(&w.usdc, &mei).await?, USDC);
    Ok(())
}

/// 10. A withdrawal whose transfer fails is put back.
#[tokio::test]
async fn failed_withdraw_recredits() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 20 * USDC).await?;
    w.deposit(&w.usdc, &studio, 20 * USDC, "").await?.ok();
    // With nothing left on the token, the business closes its token account, so a transfer to it must fail.
    w.call(&studio, &w.usdc, "storage_unregister", json!({}), ONE_YOCTO, MAX_GAS).await?.ok();

    let out = w
        .call(&studio, &w.autopilot, "withdraw", json!({ "amount": (5 * USDC).to_string() }), ONE_YOCTO, MAX_GAS)
        .await?;
    assert!(out.event("withdraw_failed").is_some(), "{:?}", out.logs);
    assert_eq!(u128_of(&w.business_view(&studio).await?["available"]), 20 * USDC);
    totals_match(&w, &[&studio]).await?;
    Ok(())
}

/// 11. Only the plan's owner manages it, only the admin pauses, and pause never blocks a withdrawal or a cancel.
#[tokio::test]
async fn auth_and_pause() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let stranger = w.business("stranger", 10 * USDC).await?;
    let mei = w.person("mei", true).await?;
    w.deposit(&w.usdc, &studio, 50 * USDC, "").await?.ok();
    let due = w.now_ms().await? + SOON_MS;
    let plan = create_plan(&w, &studio, rows(&[(&mei, 5 * USDC)]), &[due]).await?;

    w.call(&stranger, &w.autopilot, "pause_plan", json!({ "plan_id": plan }), ZERO, MAX_GAS).await?.failed_with("Not your plan");
    w.call(&stranger, &w.autopilot, "cancel_plan", json!({ "plan_id": plan }), ZERO, MAX_GAS).await?.failed_with("Not your plan");
    w.call(&stranger, &w.autopilot, "pause", json!({}), ONE_YOCTO, MAX_GAS).await?.failed_with("Admin only");

    w.call(&w.operator, &w.autopilot, "pause", json!({}), ONE_YOCTO, MAX_GAS).await?.ok();
    w.deposit(&w.usdc, &studio, 10 * USDC, "").await?;
    assert_eq!(u128_of(&w.business_view(&studio).await?["available"]), 50 * USDC, "a deposit while paused is refused");
    w.call(&studio, &w.autopilot, "create_plan", json!({ "rows": rows(&[(&mei, USDC)]), "due": [(due + 60_000).to_string()] }), ZERO, MAX_GAS)
        .await?
        .failed_with("Paused");
    w.until(due).await?;
    w.run(&w.operator, &plan, MAX_GAS).await?.failed_with("Paused");
    w.call(&studio, &w.autopilot, "withdraw", json!({ "amount": (5 * USDC).to_string() }), ONE_YOCTO, MAX_GAS).await?.ok();
    w.call(&studio, &w.autopilot, "cancel_plan", json!({ "plan_id": plan }), ZERO, MAX_GAS).await?.ok();
    assert!(w.plan(&plan).await?.is_null());
    Ok(())
}

/// 12. Storage is bounded and paid in NEAR by the operator; cancelling a plan refunds the operator, not the business.
#[tokio::test]
async fn storage_bounded_and_refunded_to_payer() -> Result<()> {
    let w = World::start().await?;
    let studio = w.business("studio", 100 * USDC).await?;
    let mei = w.person("mei", true).await?;
    let due = w.now_ms().await? + 600_000;

    let too_many: Vec<_> = (0..101).map(|_| (&mei, USDC)).collect();
    w.call(&studio, &w.autopilot, "create_plan", json!({ "rows": rows(&too_many), "due": [due.to_string()] }), ZERO, MAX_GAS)
        .await?
        .failed_with("1 to 100 rows");

    let before = u128_of(&w.business_view(&studio).await?["storage_balance"]);
    let hundred: Vec<_> = (0..100).map(|_| (&mei, USDC)).collect();
    let plan = create_plan(&w, &studio, rows(&hundred), &[due]).await?;
    let cost = u128_of(&w.plan(&plan).await?["storage_cost"]);
    assert!(cost > 0);
    assert_eq!(u128_of(&w.business_view(&studio).await?["storage_balance"]), before - cost);
    println!("storage for a 100-row plan with one date: {} yoctoNEAR", cost);

    // A business whose storage was paid for registration only can't create a plan.
    let thin = id("thin");
    w.account(&thin, NearToken::from_near(5)).await?;
    w.call(&w.operator, &w.autopilot, "storage_deposit", json!({ "account_id": thin }), NearToken::from_millinear(3), MAX_GAS)
        .await?
        .ok();
    w.call(&thin, &w.autopilot, "create_plan", json!({ "rows": rows(&[(&mei, USDC)]), "due": [due.to_string()] }), ZERO, MAX_GAS)
        .await?
        .failed_with("Not enough storage paid");

    let operator_before = w.near_balance(&w.operator).await?;
    let out = w.call(&studio, &w.autopilot, "cancel_plan", json!({ "plan_id": plan }), ZERO, MAX_GAS).await?.ok();
    let refund = u128_of(&out.event("plan_cancelled").expect("plan_cancelled")["data"]["storage_refund"]);
    assert!(refund > 0 && refund <= cost);
    let operator_after = w.near_balance(&w.operator).await?;
    assert_eq!(operator_after.as_yoctonear() - operator_before.as_yoctonear(), refund, "the payer gets it back");
    Ok(())
}
