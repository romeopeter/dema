use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::commands::clean;
use crate::error::{AppError, AppResult};
use crate::models::business::BusinessDetails;
use crate::state::AppState;

/// Guard against someone pasting a huge photograph in as a logo. Images are downscaled
/// on the frontend before they get here; this is the backstop that keeps a stray 12MP
/// PNG out of the database and off every invoice render.
const MAX_IMAGE_BYTES: usize = 512 * 1024;

fn check_image(label: &str, value: &Option<String>) -> AppResult<()> {
    let Some(data) = value else { return Ok(()) };
    if !data.starts_with("data:image/") {
        return Err(AppError::Validation(format!(
            "The {label} must be an image."
        )));
    }
    if data.len() > MAX_IMAGE_BYTES {
        return Err(AppError::Validation(format!(
            "That {label} is too large. Use an image under 512KB."
        )));
    }
    Ok(())
}

pub fn fetch(conn: &Connection, profile_id: i64) -> AppResult<BusinessDetails> {
    let sql = format!(
        "SELECT {} FROM business_details WHERE profile_id = ?1",
        BusinessDetails::COLUMNS
    );
    let found = conn
        .query_row(&sql, params![profile_id], |row| {
            Ok(BusinessDetails::from_row(row))
        })
        .optional()?;

    // A business profile that has never opened Settings has no row yet. An empty record
    // reads the same to every caller, so nothing downstream needs to handle the absence.
    match found {
        Some(details) => details,
        None => Ok(BusinessDetails {
            profile_id,
            ..Default::default()
        }),
    }
}

#[tauri::command]
pub fn get_business_details(
    state: State<'_, AppState>,
    profile_id: i64,
) -> AppResult<BusinessDetails> {
    let conn = state.conn()?;
    fetch(&conn, profile_id)
}

#[tauri::command]
pub fn set_business_details(
    state: State<'_, AppState>,
    input: BusinessDetails,
) -> AppResult<BusinessDetails> {
    let conn = state.conn()?;
    save(&conn, input)
}

pub fn save(conn: &Connection, input: BusinessDetails) -> AppResult<BusinessDetails> {
    let kind: String = conn
        .query_row(
            "SELECT type FROM profiles WHERE id = ?1",
            params![input.profile_id],
            |r| r.get(0),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("That profile no longer exists.".into()))?;

    if kind != "business" {
        return Err(AppError::Validation(
            "Only a business profile carries invoice details.".into(),
        ));
    }

    check_image("logo", &input.logo_data_url)?;
    check_image("signature", &input.signature_data_url)?;

    conn.execute(
        "INSERT INTO business_details
           (profile_id, address, email, phone, logo_data_url, signature_data_url,
            signer_name, signer_role, bank_name, account_name, account_number,
            rc_number, tin, payment_instruction)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(profile_id) DO UPDATE SET
           address = excluded.address,
           email = excluded.email,
           phone = excluded.phone,
           logo_data_url = excluded.logo_data_url,
           signature_data_url = excluded.signature_data_url,
           signer_name = excluded.signer_name,
           signer_role = excluded.signer_role,
           bank_name = excluded.bank_name,
           account_name = excluded.account_name,
           account_number = excluded.account_number,
           rc_number = excluded.rc_number,
           tin = excluded.tin,
           payment_instruction = excluded.payment_instruction",
        params![
            input.profile_id,
            clean(input.address),
            clean(input.email),
            clean(input.phone),
            input.logo_data_url,
            input.signature_data_url,
            clean(input.signer_name),
            clean(input.signer_role),
            clean(input.bank_name),
            clean(input.account_name),
            clean(input.account_number),
            clean(input.rc_number),
            clean(input.tin),
            clean(input.payment_instruction),
        ],
    )?;

    fetch(conn, input.profile_id)
}
