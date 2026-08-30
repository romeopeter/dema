use std::collections::BTreeMap;

use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::require_text;
use crate::error::AppResult;
use crate::state::AppState;

pub fn read(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .optional()?)
}

pub fn read_bool(conn: &Connection, key: &str, default: bool) -> AppResult<bool> {
    Ok(read(conn, key)?
        .map(|v| v == "true" || v == "1")
        .unwrap_or(default))
}

pub fn read_i64(conn: &Connection, key: &str, default: i64) -> AppResult<i64> {
    Ok(read(conn, key)?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(default))
}

/// The whole preference map in one call — small enough that the UI can hold all of it
/// and avoid a round trip per toggle.
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppResult<BTreeMap<String, String>> {
    let conn = state.conn()?;
    let mut stmt = conn.prepare("SELECT key, value FROM app_settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut out = BTreeMap::new();
    for row in rows {
        let (k, v) = row?;
        out.insert(k, v);
    }
    Ok(out)
}

#[tauri::command]
pub fn set_settings(
    state: State<'_, AppState>,
    values: BTreeMap<String, String>,
) -> AppResult<BTreeMap<String, String>> {
    {
        let mut conn = state.conn()?;
        let tx = conn.transaction()?;
        for (key, value) in &values {
            let key = require_text("Setting key", key)?;
            tx.execute(
                "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
        }
        tx.commit()?;
    }
    get_settings(state)
}
