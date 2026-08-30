use rusqlite::{params, Connection};
use tauri::State;

use crate::commands::{one_of, require_text};
use crate::error::{AppError, AppResult};
use crate::models::category::{Category, NewCategory};
use crate::state::AppState;

const SELECT: &str = "
    SELECT c.id, c.profile_id, c.profile_type, c.name, c.icon, c.color, c.kind,
           c.is_builtin, c.tax_deductible, c.is_deleted, c.sort_order,
           CASE WHEN h.category_id IS NULL THEN 0 ELSE 1 END AS is_hidden,
           (SELECT count(*) FROM transactions t
            WHERE t.category_id = c.id AND t.profile_id = ?1) AS transaction_count
    FROM categories c
    LEFT JOIN hidden_categories h ON h.category_id = c.id AND h.profile_id = ?1";

pub fn profile_type(conn: &Connection, profile_id: i64) -> AppResult<String> {
    conn.query_row(
        "SELECT type FROM profiles WHERE id = ?1",
        params![profile_id],
        |r| r.get(0),
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound("That profile no longer exists.".into())
        }
        other => AppError::Sqlite(other),
    })
}

/// Everything a profile can see: the built-ins for its type plus its own categories.
/// Hidden and archived rows are included and flagged — Settings needs to list them to
/// offer Restore. The picker filters them out.
#[tauri::command]
pub fn list_categories(state: State<'_, AppState>, profile_id: i64) -> AppResult<Vec<Category>> {
    let conn = state.conn()?;
    let kind = profile_type(&conn, profile_id)?;
    let sql = format!(
        "{SELECT}
         WHERE c.profile_id = ?1 OR (c.profile_id IS NULL AND c.profile_type = ?2)
         ORDER BY c.is_builtin DESC, c.sort_order, c.id"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![profile_id, kind], |row| Ok(Category::from_row(row)))?;
    rows.collect::<Result<Vec<_>, _>>()?.into_iter().collect()
}

pub fn fetch(conn: &Connection, profile_id: i64, id: i64) -> AppResult<Category> {
    let sql = format!("{SELECT} WHERE c.id = ?2");
    conn.query_row(&sql, params![profile_id, id], |row| Ok(Category::from_row(row)))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("That category no longer exists.".into())
            }
            other => AppError::Sqlite(other),
        })?
}

#[tauri::command]
pub fn create_category(state: State<'_, AppState>, input: NewCategory) -> AppResult<Category> {
    let conn = state.conn()?;
    insert_category(&conn, &input)
}

pub fn insert_category(conn: &Connection, input: &NewCategory) -> AppResult<Category> {
    let name = require_text("Category name", &input.name)?;
    let kind = one_of("Category type", &input.kind, &["income", "expense"])?;
    let icon = require_text("Icon", &input.icon)?;
    let color = require_text("Colour", &input.color)?;

    let scope = profile_type(conn, input.profile_id)?;

    // Names collide confusingly in the picker, and in the tax report they would read as
    // two separate lines for the same thing.
    let clash: i64 = conn.query_row(
        "SELECT count(*) FROM categories
         WHERE lower(name) = lower(?1) AND is_deleted = 0
           AND (profile_id = ?2 OR (profile_id IS NULL AND profile_type = ?3))",
        params![name, input.profile_id, scope],
        |r| r.get(0),
    )?;
    if clash > 0 {
        return Err(AppError::Conflict(format!("You already have a \"{name}\" category.")));
    }

    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories WHERE profile_id = ?1",
        params![input.profile_id],
        |r| r.get(0),
    )?;

    conn.execute(
        "INSERT INTO categories
           (profile_id, profile_type, name, icon, color, kind, is_builtin, tax_deductible, sort_order)
         VALUES (?1, NULL, ?2, ?3, ?4, ?5, 0, ?6, ?7)",
        params![
            input.profile_id,
            name,
            icon,
            color,
            kind,
            input.tax_deductible as i64,
            100 + next_order
        ],
    )?;
    let id = conn.last_insert_rowid();
    fetch(conn, input.profile_id, id)
}

#[tauri::command]
pub fn update_category(
    state: State<'_, AppState>,
    id: i64,
    profile_id: i64,
    name: String,
    icon: String,
    color: String,
    tax_deductible: bool,
) -> AppResult<Category> {
    let name = require_text("Category name", &name)?;
    let conn = state.conn()?;
    let changed = conn.execute(
        "UPDATE categories SET name = ?2, icon = ?3, color = ?4, tax_deductible = ?5
         WHERE id = ?1 AND is_builtin = 0",
        params![id, name, icon, color, tax_deductible as i64],
    )?;
    if changed == 0 {
        return Err(AppError::Validation(
            "Built-in categories cannot be edited. Hide it and add your own instead.".into(),
        ));
    }
    fetch(&conn, profile_id, id)
}

/// Always a soft delete. History keeps pointing at the row, so old transactions keep
/// their name, icon and colour and the tax report stays reproducible.
#[tauri::command]
pub fn delete_category(state: State<'_, AppState>, id: i64, profile_id: i64) -> AppResult<Category> {
    let conn = state.conn()?;
    archive(&conn, id)?;
    fetch(&conn, profile_id, id)
}

pub fn archive(conn: &Connection, id: i64) -> AppResult<()> {
    let is_builtin: bool = conn
        .query_row(
            "SELECT is_builtin FROM categories WHERE id = ?1",
            params![id],
            |r| r.get::<_, i64>(0),
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound("That category no longer exists.".into())
            }
            other => AppError::Sqlite(other),
        })?
        != 0;

    if is_builtin {
        return Err(AppError::Validation(
            "Built-in categories can only be hidden, not archived.".into(),
        ));
    }
    conn.execute("UPDATE categories SET is_deleted = 1 WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn restore_category(state: State<'_, AppState>, id: i64, profile_id: i64) -> AppResult<Category> {
    let conn = state.conn()?;
    conn.execute("UPDATE categories SET is_deleted = 0 WHERE id = ?1", params![id])?;
    fetch(&conn, profile_id, id)
}

/// Per-profile visibility for built-ins: the row itself is shared by every profile of that
/// type, so hiding it is recorded against the profile, not the category.
#[tauri::command]
pub fn set_category_hidden(
    state: State<'_, AppState>,
    id: i64,
    profile_id: i64,
    hidden: bool,
) -> AppResult<Category> {
    let conn = state.conn()?;
    if hidden {
        conn.execute(
            "INSERT OR IGNORE INTO hidden_categories (profile_id, category_id) VALUES (?1, ?2)",
            params![profile_id, id],
        )?;
    } else {
        conn.execute(
            "DELETE FROM hidden_categories WHERE profile_id = ?1 AND category_id = ?2",
            params![profile_id, id],
        )?;
    }
    fetch(&conn, profile_id, id)
}
