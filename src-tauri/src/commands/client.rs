use rusqlite::{params, Connection};
use tauri::State;

use crate::commands::{clean, require_text};
use crate::error::{AppError, AppResult};
use crate::models::client::{Client, ClientInput};
use crate::state::AppState;

fn fetch(conn: &Connection, id: i64) -> AppResult<Client> {
    let sql = format!("{} WHERE c.id = ?1", Client::SELECT);
    conn.query_row(&sql, params![id], |row| Ok(Client::from_row(row)))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("That client no longer exists.".into())
            }
            other => AppError::Sqlite(other),
        })?
}

#[tauri::command]
pub fn list_clients(state: State<'_, AppState>, profile_id: i64) -> AppResult<Vec<Client>> {
    let conn = state.conn()?;
    let sql = format!(
        "{} WHERE c.profile_id = ?1 ORDER BY invoiced_cents DESC, c.name",
        Client::SELECT
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![profile_id], |row| Ok(Client::from_row(row)))?;
    rows.collect::<Result<Vec<_>, _>>()?.into_iter().collect()
}

#[tauri::command]
pub fn create_client(state: State<'_, AppState>, input: ClientInput) -> AppResult<Client> {
    let conn = state.conn()?;
    insert_client(&conn, input)
}

pub fn insert_client(conn: &Connection, input: ClientInput) -> AppResult<Client> {
    let name = require_text("Client name", &input.name)?;
    conn.execute(
        "INSERT INTO clients (profile_id, name, email, phone, address, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            input.profile_id,
            name,
            clean(input.email),
            clean(input.phone),
            clean(input.address),
            clean(input.notes)
        ],
    )?;
    fetch(conn, conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_client(state: State<'_, AppState>, id: i64, input: ClientInput) -> AppResult<Client> {
    let name = require_text("Client name", &input.name)?;
    let conn = state.conn()?;
    let changed = conn.execute(
        "UPDATE clients SET name = ?2, email = ?3, phone = ?4, address = ?5, notes = ?6
         WHERE id = ?1",
        params![
            id,
            name,
            clean(input.email),
            clean(input.phone),
            clean(input.address),
            clean(input.notes)
        ],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("That client no longer exists.".into()));
    }
    fetch(&conn, id)
}

/// Refused while invoices still point at the client — deleting would orphan them.
#[tauri::command]
pub fn delete_client(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let conn = state.conn()?;
    let invoices: i64 = conn.query_row(
        "SELECT count(*) FROM invoices WHERE client_id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    if invoices > 0 {
        return Err(AppError::Conflict(format!(
            "This client has {invoices} invoice(s). Those records would be orphaned."
        )));
    }
    let changed = conn.execute("DELETE FROM clients WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound("That client no longer exists.".into()));
    }
    Ok(())
}
