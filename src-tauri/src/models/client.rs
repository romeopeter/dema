use rusqlite::Row;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Client {
    pub id: i64,
    pub profile_id: i64,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    /// Lifetime invoiced total, excluding drafts.
    pub invoiced_cents: i64,
    /// Sent or overdue invoices still unpaid.
    pub outstanding_cents: i64,
}

impl Client {
    pub const SELECT: &'static str = "
        SELECT c.id, c.profile_id, c.name, c.email, c.phone, c.address, c.notes,
               COALESCE((SELECT SUM(i.total_amount_cents) FROM invoices i
                         WHERE i.client_id = c.id AND i.status <> 'draft'), 0) AS invoiced_cents,
               COALESCE((SELECT SUM(i.total_amount_cents) FROM invoices i
                         WHERE i.client_id = c.id AND i.status IN ('sent', 'overdue')), 0) AS outstanding_cents
        FROM clients c";

    pub fn from_row(row: &Row<'_>) -> AppResult<Self> {
        Ok(Self {
            id: row.get("id")?,
            profile_id: row.get("profile_id")?,
            name: row.get("name")?,
            email: row.get("email")?,
            phone: row.get("phone")?,
            address: row.get("address")?,
            notes: row.get("notes")?,
            invoiced_cents: row.get("invoiced_cents")?,
            outstanding_cents: row.get("outstanding_cents")?,
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInput {
    pub profile_id: i64,
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}
