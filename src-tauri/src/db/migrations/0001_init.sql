-- Dema core schema.
-- All money is stored as integer minor units (kobo). Never floats.

CREATE TABLE profiles (
  id         INTEGER PRIMARY KEY,
  type       TEXT NOT NULL UNIQUE CHECK (type IN ('personal', 'business')),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A category is either a built-in (profile_id NULL, scoped to a profile *type*)
-- or a user category owned by one profile.
CREATE TABLE categories (
  id             INTEGER PRIMARY KEY,
  profile_id     INTEGER REFERENCES profiles(id),
  profile_type   TEXT CHECK (profile_type IN ('personal', 'business')),
  name           TEXT NOT NULL,
  icon           TEXT NOT NULL,
  color          TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  is_builtin     INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),
  tax_deductible INTEGER NOT NULL DEFAULT 0 CHECK (tax_deductible IN (0, 1)),
  is_deleted     INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (is_builtin = 1 AND profile_id IS NULL AND profile_type IS NOT NULL) OR
    (is_builtin = 0 AND profile_id IS NOT NULL)
  )
);

-- Built-ins cannot be deleted, only hidden per profile.
CREATE TABLE hidden_categories (
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, category_id)
);

CREATE TABLE clients (
  id         INTEGER PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invoices (
  id                 INTEGER PRIMARY KEY,
  profile_id         INTEGER NOT NULL REFERENCES profiles(id),
  client_id          INTEGER NOT NULL REFERENCES clients(id),
  invoice_number     TEXT NOT NULL,
  issue_date         TEXT NOT NULL,
  due_date           TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  subtotal_cents     INTEGER NOT NULL DEFAULT 0,
  vat_rate_bp        INTEGER NOT NULL DEFAULT 750, -- basis points; 750 = 7.5%
  vat_cents          INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  notes              TEXT,
  paid_at            TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, invoice_number)
);

CREATE TABLE invoice_line_items (
  id               INTEGER PRIMARY KEY,
  invoice_id       INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  quantity         REAL NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
  id           INTEGER PRIMARY KEY,
  profile_id   INTEGER NOT NULL REFERENCES profiles(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'card', 'check')),
  status       TEXT NOT NULL CHECK (status IN ('draft', 'posted')),
  kind         TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  date         TEXT NOT NULL,
  note         TEXT,
  invoice_id   INTEGER REFERENCES invoices(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tx_profile_date   ON transactions (profile_id, date DESC);
CREATE INDEX idx_tx_profile_status ON transactions (profile_id, status);
CREATE INDEX idx_tx_category       ON transactions (category_id);
CREATE UNIQUE INDEX idx_tx_invoice ON transactions (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_cat_scope         ON categories (profile_id, profile_type);
CREATE INDEX idx_inv_profile       ON invoices (profile_id, status);
CREATE INDEX idx_line_invoice      ON invoice_line_items (invoice_id, position);
CREATE INDEX idx_client_profile    ON clients (profile_id);

-- Built-in categories. `brand` as a colour resolves to the active brand tint in the UI.
INSERT INTO categories (profile_id, profile_type, name, icon, color, kind, is_builtin, tax_deductible, sort_order) VALUES
  (NULL, 'personal', 'Food',          'food',      '#F6D9A9', 'expense', 1, 0, 1),
  (NULL, 'personal', 'Transport',     'transport', '#B8DCF0', 'expense', 1, 0, 2),
  (NULL, 'personal', 'Groceries',     'shopping',  '#F0C6D9', 'expense', 1, 0, 3),
  (NULL, 'personal', 'Bills',         'bills',     '#F0E3A9', 'expense', 1, 0, 4),
  (NULL, 'personal', 'Health',        'health',    '#C3EDE0', 'expense', 1, 0, 5),
  (NULL, 'personal', 'Salary',        'salary',    'brand',   'income',  1, 0, 6),
  (NULL, 'personal', 'Fun',           'fun',       '#DDD4F0', 'expense', 1, 0, 7),
  (NULL, 'personal', 'Other',         'office',    '#DADEE5', 'expense', 1, 0, 8),
  (NULL, 'business', 'Client payment','invoice',   '#F0E3A9', 'income',  1, 0, 1),
  (NULL, 'business', 'Software',      'software',  '#DDD4F0', 'expense', 1, 1, 2),
  (NULL, 'business', 'Office',        'office',    '#DADEE5', 'expense', 1, 1, 3),
  (NULL, 'business', 'Contractors',   'shopping',  '#F0C6D9', 'expense', 1, 1, 4),
  (NULL, 'business', 'Travel',        'transport', '#B8DCF0', 'expense', 1, 1, 5),
  (NULL, 'business', 'Meals',         'food',      '#F6D9A9', 'expense', 1, 1, 6),
  (NULL, 'business', 'Utilities',     'bills',     '#F0E3A9', 'expense', 1, 1, 7),
  (NULL, 'business', 'Other',         'health',    '#C3EDE0', 'expense', 1, 0, 8);
