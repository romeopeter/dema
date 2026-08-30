# DEXT

A local-first desktop finance ledger for personal and business books. No server, no
account, no billing, no sync — Everything lives on your machine and the Rust side is the only
thing that touches it.

Tauri 2 + Rust + SQLite on the back, React 19 + TypeScript + Tailwind 4 on the front.

## Running it

```bash
npm install
npm run app        # tauri dev — builds Rust, starts Vite, opens the window
npm run app:build  # production bundle
```

Checks:

```bash
npm run typecheck                # frontend
cd src-tauri && cargo test       # schema, money maths, acceptance tests
```

## How it is put together

```
src-tauri/src/
  lib.rs              command registry and app setup
  state.rs            AppState { db: Mutex<Connection> }
  error.rs            AppError — serialises as { kind, message, detail }
  db/                 connection, PRAGMAs, migration runner
    migrations/       0001_init.sql, 0002_app_settings.sql
  models/             serde structs mirroring src/lib/types.ts 1:1
  commands/           one module per feature; each command is a thin wrapper
  pdf.rs              dependency-free PDF writer for the report export
  tests.rs            acceptance tests

src/
  lib/tauri.ts        the only place invoke() is called
  lib/types.ts        TypeScript mirrors of the Rust structs
  lib/theme.ts        brand palette maths, contrast guard, theme scoping
  lib/format.ts       naira formatting and integer-kobo parsing
  lib/useQuery.ts     the whole data layer
  store/              Zustand: profile, settings, UI
  features/           transactions, invoices, clients, reports, profile
  routes/             screens + the memory router
  components/ui/      shared primitives
```

### Money

Every amount is an integer number of kobo, in SQLite, over IPC, and in TypeScript. The
only float in the system is an invoice line's *quantity* (2.5 days, 0.75 hours), and
`line_amount_cents` rounds its product to whole kobo immediately — nothing downstream
ever sees a fractional currency value. `parseAmountToCents` reads what a person typed by
splitting the string, so `12,500.05` never becomes `1250.0499999`.

### Drafts

A transaction is `draft` or `posted`. Every aggregate — dashboard totals, the donut, top
categories, the tax report — filters `status = 'posted'` in SQL. There is no code path
where a draft reaches a total.

### Invoices and income

`mark_invoice_paid` is one SQLite transaction: the invoice flips to paid *and* the linked
income row is inserted, or neither happens. A unique partial index on
`transactions(invoice_id)` backs that up at the schema level. The linked transaction
refuses to be edited or deleted on its own — `reopen_invoice` undoes both halves
together, which is the only way back.

### Categories

Built-ins are shared rows scoped to a profile *type*; a profile hides one by writing to
`hidden_categories`, never by deleting. Your own categories archive with
`is_deleted = 1`. Nothing ever hard-deletes a category, so a transaction from two years
ago still resolves its name, icon and colour and last year's report still reproduces.

### Profiles

The active profile scopes every query and is persisted in `app_settings`. Switching
happens only in Settings → Active profile; the sidebar chip navigates there rather than
switching in place. Categories are checked against the profile on write, so business
spending cannot land in the personal book.

### Reactivity

`mutate()` in `src/lib/mutate.ts` runs a mutation then bumps a revision counter that
every `useQuery` depends on. That is what makes the dashboard figures and the donut
reflect the latest posted state the moment something changes, from anywhere.

## Where this departs from the prototype

The design bundle in `design_handoff_dext_desktop/` is the visual spec. Three deliberate
differences:

1. **Theme scoping.** The handoff flagged that the business brand theme leaked into the
   personal profile. `resolveTheme` returns the factory palette whenever the active
   profile is not business, so there is no path for the leak.
2. **Profile names.** The prototype hardcoded "David" and "Duowork Software Solutions".
   Onboarding now asks, and Settings → Preferences can rename.
3. **"Preview empty profile"** is gone. It was a switch for demoing empty states in a
   prototype with fixture data; the real empty states appear when the ledger is actually
   empty.

The category picker also filters to the selected income/expense side, rather than
offering every category regardless — otherwise "Salary" is selectable as an expense.

## Still open

- Invoices are not rendered to PDF or emailed; only the report exports (CSV and PDF).
- The reminder preference is stored and drives the notification panel, but there is no
  scheduled nudge.
- Fonts are self-hosted via `@fontsource`; the onboarding photograph ships as supplied.
