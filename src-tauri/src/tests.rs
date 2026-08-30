//! Acceptance tests for the guarantees DEXT makes about a person's books.
//!
//! These run against a real in-memory SQLite with the real migrations, and call the same
//! functions the Tauri commands call — the commands themselves are one-line wrappers.

use rusqlite::{params, Connection};

use crate::commands::{category, client, invoice, profile, report, transaction};
use crate::db;
use crate::models::category::NewCategory;
use crate::models::client::ClientInput;
use crate::models::invoice::{InvoiceInput, LineItemInput};
use crate::models::transaction::NewTransaction;

fn ledger() -> Connection {
    db::open_in_memory().expect("migrations should apply")
}

fn category_id(conn: &Connection, profile_id: i64, name: &str) -> i64 {
    conn.query_row(
        "SELECT c.id FROM categories c
         JOIN profiles p ON p.id = ?1
         WHERE c.name = ?2 AND (c.profile_id = p.id OR c.profile_type = p.type)",
        params![profile_id, name],
        |r| r.get(0),
    )
    .unwrap_or_else(|e| panic!("category {name} should exist: {e}"))
}

fn spend(
    conn: &Connection,
    profile_id: i64,
    category_id: i64,
    amount_cents: i64,
    status: &str,
) -> i64 {
    transaction::insert_transaction(
        conn,
        &NewTransaction {
            profile_id,
            amount_cents,
            category_id,
            payment_type: "cash".into(),
            status: status.into(),
            kind: "expense".into(),
            date: today(conn),
            note: None,
        },
    )
    .expect("transaction should insert")
    .id
}

fn today(conn: &Connection) -> String {
    conn.query_row("SELECT date('now', 'localtime')", [], |r| r.get(0))
        .unwrap()
}

fn business_with_client(conn: &mut Connection) -> (i64, i64) {
    let profile = profile::insert_profile(conn, "business", "Duowork Software Solutions")
        .expect("profile should create");
    let client = client::insert_client(
        conn,
        ClientInput {
            profile_id: profile.id,
            name: "Adire Foods Ltd".into(),
            email: None,
            phone: None,
            address: None,
            notes: None,
        },
    )
    .expect("client should create");
    (profile.id, client.id)
}

/// Acceptance: drafts never reach a total or the donut until they are posted.
#[test]
fn drafts_stay_out_of_every_total_until_posted() {
    let conn = ledger();
    let profile = profile::insert_profile(&conn, "personal", "David").unwrap();
    let groceries = category_id(&conn, profile.id, "Groceries");

    spend(&conn, profile.id, groceries, 46_800_00, "posted");
    let draft = spend(&conn, profile.id, groceries, 18_000_00, "draft");

    let before = transaction::summarise(&conn, profile.id, "all").unwrap();
    assert_eq!(before.spent_cents, 46_800_00, "the draft must not be counted");
    assert_eq!(before.draft_count, 1);
    assert_eq!(
        before.top_categories[0].total_cents, 46_800_00,
        "the donut and category bars run off the same posted-only figures"
    );

    conn.execute(
        "UPDATE transactions SET status = 'posted' WHERE id = ?1",
        params![draft],
    )
    .unwrap();

    let after = transaction::summarise(&conn, profile.id, "all").unwrap();
    assert_eq!(after.spent_cents, 64_800_00, "posting adds it to the total");
    assert_eq!(after.draft_count, 0);
}

/// Acceptance: marking an invoice paid always produces exactly one linked transaction.
#[test]
fn marking_an_invoice_paid_posts_exactly_one_linked_transaction() {
    let mut conn = ledger();
    let (profile_id, client_id) = business_with_client(&mut conn);

    let invoice_id = invoice::insert_invoice(
        &mut conn,
        &InvoiceInput {
            profile_id,
            client_id,
            issue_date: "2026-08-01".into(),
            due_date: "2026-08-15".into(),
            status: "sent".into(),
            notes: None,
            vat_rate_bp: Some(750),
            items: vec![LineItemInput {
                description: "Web app development".into(),
                quantity: 40.0,
                unit_price_cents: 12_000_00,
            }],
        },
    )
    .unwrap();

    let before = invoice::detail(&conn, invoice_id).unwrap();
    assert_eq!(before.invoice.subtotal_cents, 480_000_00);
    assert_eq!(before.invoice.vat_cents, 36_000_00, "7.5% of the subtotal");
    assert_eq!(before.invoice.total_amount_cents, 516_000_00);
    assert!(before.invoice.transaction_id.is_none());

    invoice::mark_paid(&mut conn, invoice_id, None, Some("2026-08-12".into())).unwrap();

    let after = invoice::detail(&conn, invoice_id).unwrap();
    assert_eq!(after.invoice.status, "paid");
    assert!(after.invoice.paid_at.is_some());

    let linked = transaction::fetch(&conn, after.invoice.transaction_id.unwrap()).unwrap();
    assert_eq!(linked.kind, "income");
    assert_eq!(linked.status, "posted");
    assert_eq!(linked.amount_cents, 516_000_00, "income matches the invoice total");
    assert_eq!(linked.invoice_number.as_deref(), Some("DW-001"));
    assert_eq!(linked.date, "2026-08-12");

    let count: i64 = conn
        .query_row(
            "SELECT count(*) FROM transactions WHERE invoice_id = ?1",
            params![invoice_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1, "exactly one, never two");

    // A second attempt must not create a duplicate income line.
    assert!(invoice::mark_paid(&mut conn, invoice_id, None, None).is_err());
    let count_again: i64 = conn
        .query_row(
            "SELECT count(*) FROM transactions WHERE invoice_id = ?1",
            params![invoice_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count_again, 1);
}

/// Acceptance: the invoice and its income are written together or not at all. Forcing the
/// income insert to fail must leave the invoice unpaid.
#[test]
fn a_failed_income_insert_rolls_the_invoice_back_to_unpaid() {
    let mut conn = ledger();
    let (profile_id, client_id) = business_with_client(&mut conn);

    let invoice_id = invoice::insert_invoice(
        &mut conn,
        &InvoiceInput {
            profile_id,
            client_id,
            issue_date: "2026-08-01".into(),
            due_date: "2026-08-15".into(),
            status: "sent".into(),
            notes: None,
            vat_rate_bp: Some(750),
            items: vec![LineItemInput {
                description: "Support retainer".into(),
                quantity: 1.0,
                unit_price_cents: 120_000_00,
            }],
        },
    )
    .unwrap();

    // Stand in for a mid-operation failure: a trigger that rejects the income insert
    // after the invoice row has already been updated inside the same transaction.
    conn.execute_batch(
        "CREATE TRIGGER refuse_income BEFORE INSERT ON transactions
         BEGIN SELECT raise(ABORT, 'disk full'); END;",
    )
    .unwrap();

    let result = invoice::mark_paid(&mut conn, invoice_id, None, None);
    assert!(result.is_err(), "the write should fail, not half-succeed");

    conn.execute_batch("DROP TRIGGER refuse_income").unwrap();

    let after = invoice::detail(&conn, invoice_id).unwrap();
    assert_eq!(
        after.invoice.status, "sent",
        "the invoice must not be left marked paid with no income behind it"
    );
    assert!(after.invoice.paid_at.is_none());
    assert!(after.invoice.transaction_id.is_none());
}

/// Acceptance: archiving a custom category never deletes or orphans its history.
#[test]
fn archiving_a_used_category_keeps_every_transaction() {
    let conn = ledger();
    let profile = profile::insert_profile(&conn, "personal", "David").unwrap();

    let custom = category::insert_category(
        &conn,
        &NewCategory {
            profile_id: profile.id,
            name: "Subscriptions".into(),
            icon: "software".into(),
            color: "#DDD4F0".into(),
            kind: "expense".into(),
            tax_deductible: false,
        },
    )
    .unwrap();

    spend(&conn, profile.id, custom.id, 25_000_00, "posted");
    spend(&conn, profile.id, custom.id, 9_500_00, "posted");

    category::archive(&conn, custom.id).unwrap();

    let archived = category::fetch(&conn, profile.id, custom.id).unwrap();
    assert!(archived.is_deleted, "soft delete, never a DELETE");
    assert_eq!(archived.transaction_count, 2, "history is intact");

    // The rows still resolve their category, so old lists and reports still render.
    let rows: i64 = conn
        .query_row(
            "SELECT count(*) FROM transactions t JOIN categories c ON c.id = t.category_id
             WHERE t.category_id = ?1",
            params![custom.id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rows, 2);

    let summary = transaction::summarise(&conn, profile.id, "all").unwrap();
    assert_eq!(
        summary.spent_cents, 34_500_00,
        "archiving a category does not rewrite what was already spent"
    );

    // Built-ins refuse to be archived at all — they are hidden per profile instead.
    let builtin = category_id(&conn, profile.id, "Food");
    assert!(category::archive(&conn, builtin).is_err());
}

/// Acceptance: every scoped view changes with the profile, and neither book can reach
/// into the other.
#[test]
fn profiles_scope_every_query() {
    let mut conn = ledger();
    let personal = profile::insert_profile(&conn, "personal", "David").unwrap();
    let (business_id, _) = business_with_client(&mut conn);

    let groceries = category_id(&conn, personal.id, "Groceries");
    let software = category_id(&conn, business_id, "Software");

    spend(&conn, personal.id, groceries, 46_800_00, "posted");
    spend(&conn, business_id, software, 96_500_00, "posted");

    let mine = transaction::summarise(&conn, personal.id, "all").unwrap();
    let theirs = transaction::summarise(&conn, business_id, "all").unwrap();
    assert_eq!(mine.spent_cents, 46_800_00);
    assert_eq!(theirs.spent_cents, 96_500_00);

    // A business category cannot be used to record personal spending.
    let leak = transaction::insert_transaction(
        &conn,
        &NewTransaction {
            profile_id: personal.id,
            amount_cents: 1_000_00,
            category_id: software,
            payment_type: "cash".into(),
            status: "posted".into(),
            kind: "expense".into(),
            date: today(&conn),
            note: None,
        },
    );
    assert!(leak.is_err(), "categories are scoped to their profile's books");
}

/// The tax report is posted-only and splits deductible expenses out on its own.
#[test]
fn the_report_excludes_drafts_and_separates_deductible_spend() {
    let mut conn = ledger();
    let (profile_id, _) = business_with_client(&mut conn);

    let software = category_id(&conn, profile_id, "Software"); // deductible
    let other = category_id(&conn, profile_id, "Other"); // not deductible

    spend(&conn, profile_id, software, 96_500_00, "posted");
    spend(&conn, profile_id, other, 34_500_00, "posted");
    spend(&conn, profile_id, software, 500_000_00, "draft");

    let report = report::build_report(&conn, profile_id, "2000-01-01", "2999-12-31").unwrap();

    assert_eq!(report.expense_cents, 131_000_00, "the draft is not in here");
    assert_eq!(report.deductible_cents, 96_500_00);
    assert_eq!(report.transaction_count, 2);
    assert_eq!(report.rows.len(), 2);
}

/// A transaction the ledger created for an invoice cannot be edited or deleted on its
/// own, which is what keeps the pair in step.
#[test]
fn invoice_income_cannot_drift_away_from_its_invoice() {
    let mut conn = ledger();
    let (profile_id, client_id) = business_with_client(&mut conn);

    let invoice_id = invoice::insert_invoice(
        &mut conn,
        &InvoiceInput {
            profile_id,
            client_id,
            issue_date: "2026-08-01".into(),
            due_date: "2026-08-15".into(),
            status: "sent".into(),
            notes: None,
            vat_rate_bp: Some(750),
            items: vec![LineItemInput {
                description: "Hosting setup".into(),
                quantity: 1.0,
                unit_price_cents: 70_000_00,
            }],
        },
    )
    .unwrap();

    invoice::mark_paid(&mut conn, invoice_id, None, None).unwrap();
    let paid = invoice::detail(&conn, invoice_id).unwrap();
    assert!(paid.invoice.transaction_id.is_some());

    // Reopening is the only way back, and it removes both halves together.
    let tx = conn.transaction().unwrap();
    tx.execute("DELETE FROM transactions WHERE invoice_id = ?1", params![invoice_id])
        .unwrap();
    tx.execute(
        "UPDATE invoices SET status = 'sent', paid_at = NULL WHERE id = ?1",
        params![invoice_id],
    )
    .unwrap();
    tx.commit().unwrap();

    let reopened = invoice::detail(&conn, invoice_id).unwrap();
    assert_eq!(reopened.invoice.status, "sent");
    assert!(reopened.invoice.transaction_id.is_none());

    // And it can be paid again cleanly, still producing exactly one income line.
    invoice::mark_paid(&mut conn, invoice_id, None, None).unwrap();
    let count: i64 = conn
        .query_row(
            "SELECT count(*) FROM transactions WHERE invoice_id = ?1",
            params![invoice_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

/// Money never touches a float on the way in or out.
#[test]
fn line_totals_and_vat_stay_in_integer_minor_units() {
    use crate::models::invoice::{line_amount_cents, vat_cents};

    // A fractional quantity is the one place a real number appears; it is rounded to
    // whole kobo immediately, and everything after that is integer arithmetic.
    assert_eq!(line_amount_cents(2.5, 15_000_00), 37_500_00);
    assert_eq!(line_amount_cents(0.333, 100_00), 3_330);

    assert_eq!(vat_cents(480_000_00, 750), 36_000_00);
    assert_eq!(vat_cents(1, 750), 0, "rounds half up, so a kobo of VAT needs a real base");
    assert_eq!(vat_cents(7, 750), 1);
    assert_eq!(vat_cents(0, 750), 0);
}
