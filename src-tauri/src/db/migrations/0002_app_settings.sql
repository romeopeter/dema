-- Durable UI/app preferences: brand theme, week start, draft reminders, currency.
-- Keyed store so a new preference never needs a schema change.
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES
  ('currency',          'NGN'),
  ('week_start_monday', 'false'),
  ('remind_drafts',     'true'),
  ('invoice_prefix',    'DW'),
  ('vat_rate_bp',       '750'),
  ('theme_id',          'factory'),
  ('theme_count',       '3'),
  ('theme_primary',     '#8FCB8D'),
  ('theme_secondary',   '#F3A995'),
  ('theme_tertiary',    '#F6D9A9');
