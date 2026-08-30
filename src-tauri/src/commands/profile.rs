use rusqlite::{params, Connection};
use tauri::State;

use crate::commands::{one_of, require_text};
use crate::error::{AppError, AppResult};
use crate::models::profile::Profile;
use crate::state::AppState;

/// Creating a profile, without the Tauri wrapper — the commands in this crate are thin
/// shells over functions like this one so the ledger's behaviour can be tested directly
/// against a connection.
pub fn insert_profile(conn: &Connection, profile_type: &str, name: &str) -> AppResult<Profile> {
    let kind = one_of("Profile type", profile_type, &["personal", "business"])?;
    let name = require_text("Profile name", name)?;

    let exists: i64 = conn.query_row(
        "SELECT count(*) FROM profiles WHERE type = ?1",
        params![kind],
        |r| r.get(0),
    )?;
    if exists > 0 {
        return Err(AppError::Conflict(format!(
            "A {kind} profile already exists."
        )));
    }

    conn.execute(
        "INSERT INTO profiles (type, name) VALUES (?1, ?2)",
        params![kind, name],
    )?;
    fetch(conn, conn.last_insert_rowid())
}

fn fetch(conn: &Connection, id: i64) -> AppResult<Profile> {
    let sql = format!("SELECT {} FROM profiles WHERE id = ?1", Profile::COLUMNS);
    conn.query_row(&sql, params![id], |row| Ok(Profile::from_row(row)))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("That profile no longer exists.".into())
            }
            other => AppError::Sqlite(other),
        })?
}

#[tauri::command]
pub fn list_profiles(state: State<'_, AppState>) -> AppResult<Vec<Profile>> {
    let conn = state.conn()?;
    let sql = format!(
        "SELECT {} FROM profiles ORDER BY CASE type WHEN 'personal' THEN 0 ELSE 1 END",
        Profile::COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| Ok(Profile::from_row(row)))?;
    rows.collect::<Result<Vec<_>, _>>()?.into_iter().collect()
}

/// Creates Personal or Business. Only one of each can exist, which is what the Settings
/// "Add <other> profile" row relies on.
#[tauri::command]
pub fn create_profile(
    state: State<'_, AppState>,
    profile_type: String,
    name: String,
) -> AppResult<Profile> {
    let conn = state.conn()?;
    insert_profile(&conn, &profile_type, &name)
}

#[tauri::command]
pub fn rename_profile(state: State<'_, AppState>, id: i64, name: String) -> AppResult<Profile> {
    let name = require_text("Profile name", &name)?;
    let conn = state.conn()?;
    let changed = conn.execute(
        "UPDATE profiles SET name = ?2 WHERE id = ?1",
        params![id, name],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("That profile no longer exists.".into()));
    }
    fetch(&conn, id)
}
