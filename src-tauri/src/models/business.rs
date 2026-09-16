use rusqlite::Row;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

/// The issuer half of an invoice: who is billing, how to pay them, and the marks a
/// Nigerian business invoice carries. It belongs to the business profile, not to any one
/// invoice — a document reads it at render time, so correcting the address fixes every
/// future invoice without rewriting history.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessDetails {
    pub profile_id: i64,
    pub address: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub logo_data_url: Option<String>,
    pub signature_data_url: Option<String>,
    pub signer_name: Option<String>,
    pub signer_role: Option<String>,
    pub bank_name: Option<String>,
    pub account_name: Option<String>,
    pub account_number: Option<String>,
    pub rc_number: Option<String>,
    pub tin: Option<String>,
    pub payment_instruction: Option<String>,
}

impl BusinessDetails {
    pub const COLUMNS: &'static str = "profile_id, address, email, phone, logo_data_url,
        signature_data_url, signer_name, signer_role, bank_name, account_name,
        account_number, rc_number, tin, payment_instruction";

    pub fn from_row(row: &Row<'_>) -> AppResult<Self> {
        Ok(Self {
            profile_id: row.get("profile_id")?,
            address: row.get("address")?,
            email: row.get("email")?,
            phone: row.get("phone")?,
            logo_data_url: row.get("logo_data_url")?,
            signature_data_url: row.get("signature_data_url")?,
            signer_name: row.get("signer_name")?,
            signer_role: row.get("signer_role")?,
            bank_name: row.get("bank_name")?,
            account_name: row.get("account_name")?,
            account_number: row.get("account_number")?,
            rc_number: row.get("rc_number")?,
            tin: row.get("tin")?,
            payment_instruction: row.get("payment_instruction")?,
        })
    }
}

/// Everything the printable document needs, in one call. Assembling it server-side keeps
/// the template from stitching four separate queries together and getting a half-rendered
/// invoice while they land.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceDocument {
    pub invoice: super::invoice::Invoice,
    pub items: Vec<super::invoice::LineItem>,
    pub client: super::client::Client,
    pub business_name: String,
    pub business: BusinessDetails,
    /// Fields a person still needs to fill in before this prints well.
    pub missing: Vec<String>,
}
