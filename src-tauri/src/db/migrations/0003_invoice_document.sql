-- Everything the printable business invoice needs that the ledger did not already hold.
--
-- Split deliberately: issuer identity, bank details and marks live on the business
-- profile and are *read* by an invoice; amounts and presentation live on the invoice
-- record. Reopening an invoice therefore exports identically, while changing the
-- business address updates every future document without touching history.

-- One row per business profile. Kept out of `profiles` so the personal book carries
-- none of these columns.
CREATE TABLE business_details (
  profile_id          INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  address             TEXT,
  email               TEXT,
  phone               TEXT,
  -- Stored as data URLs. They are small (downscaled on the way in) and travelling
  -- inside the database means a copied .sqlite3 file is still a complete backup.
  logo_data_url       TEXT,
  signature_data_url  TEXT,
  signer_name         TEXT,
  signer_role         TEXT,
  bank_name           TEXT,
  account_name        TEXT,
  account_number      TEXT,
  rc_number           TEXT,
  tin                 TEXT,
  payment_instruction TEXT
);

-- Amounts. Integer kobo, like every other money column.
ALTER TABLE invoices ADD COLUMN discount_cents    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0;

-- Which rows the document prints. Presentation, but per-invoice and persisted so a
-- reopened invoice exports exactly as it was sent.
ALTER TABLE invoices ADD COLUMN show_subtotal  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN show_discount  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN show_vat       INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN show_paid      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN show_balance   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN show_grand     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN show_notes     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN show_signature INTEGER NOT NULL DEFAULT 1;

-- Tax moves from the invoice header onto each line: the document prints a Tax column
-- per row, and a real invoice can mix rates (VAT-able work beside an exempt disbursement).
-- `invoices.vat_rate_bp` stays as the default applied to new lines.
ALTER TABLE invoice_line_items ADD COLUMN tax_rate_bp INTEGER NOT NULL DEFAULT 750;

-- Existing lines inherit their invoice's rate, so every stored total stays exactly
-- what it was before this migration.
UPDATE invoice_line_items
SET tax_rate_bp = (
  SELECT i.vat_rate_bp FROM invoices i WHERE i.id = invoice_line_items.invoice_id
)
WHERE EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_line_items.invoice_id);
