use rusqlite::Row;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: i64,
    #[serde(rename = "type")]
    pub kind: String,
    pub name: String,
    pub created_at: String,
}

impl Profile {
    pub const COLUMNS: &'static str = "id, type, name, created_at";

    pub fn from_row(row: &Row<'_>) -> AppResult<Self> {
        Ok(Self {
            id: row.get("id")?,
            kind: row.get("type")?,
            name: row.get("name")?,
            created_at: row.get("created_at")?,
        })
    }
}
