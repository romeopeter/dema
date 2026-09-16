/**
 * Money is integer minor units (kobo) everywhere — in SQLite, over IPC, and in here.
 * Nothing in this file multiplies or divides a currency value as a float.
 */

const NAIRA = "₦";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * `₦46,800` for whole amounts, `₦46,800.50` when there are kobo. Always the absolute
 * value — callers add their own sign, since income and expense are styled differently.
 */
export function money(cents: number, options: { sign?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const body = `${NAIRA}${group(String(major))}${
    minor === 0 ? "" : `.${String(minor).padStart(2, "0")}`
  }`;
  if (!options.sign) return body;
  return `${negative ? "−" : "+"}${body}`;
}

/**
 * `₦1,505,000.00` — always two decimals, for the printed invoice. A document that
 * writes `₦1,505,000` next to `₦46,800.50` looks like a rounding error to whoever is
 * paying it, so the template never uses the shorter `money()`.
 */
export function moneyExact(cents: number, options: { sign?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const body = `${NAIRA}${group(String(Math.floor(abs / 100)))}.${String(abs % 100).padStart(2, "0")}`;
  if (!options.sign) return body;
  return `${negative ? "−" : ""}${body}`;
}

/** A basis-point rate as a percentage label: 750 -> `7.5%`, 0 -> `—`. */
export function taxRateLabel(bp: number): string {
  if (bp === 0) return "—";
  const percent = bp / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

/** Bare number with grouping, for inputs and table cells that carry their own symbol. */
export function amountOnly(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const minor = abs % 100;
  const major = group(String(Math.floor(abs / 100)));
  return minor === 0 ? major : `${major}.${String(minor).padStart(2, "0")}`;
}

/**
 * Parses what a person typed into integer minor units, without ever building a float
 * from the currency: the decimals are read as their own integer string.
 * Returns null when the text is not a usable amount.
 */
export function parseAmountToCents(input: string): number | null {
  const raw = input.trim().replace(/,/g, "");
  if (raw === "") return null;
  if (!/^\d*\.?\d*$/.test(raw)) return null;

  const [whole = "", fraction = ""] = raw.split(".");
  if (whole === "" && fraction === "") return null;

  const major = whole === "" ? 0 : Number(whole);
  const minor = Number((fraction + "00").slice(0, 2) || "0");
  if (!Number.isSafeInteger(major) || Number.isNaN(minor)) return null;

  return major * 100 + minor;
}

/** Why an amount is unusable, phrased for the field's error line. */
export function amountError(input: string): string {
  const raw = input.trim();
  if (raw === "") return "";
  if (!/^[0-9,]*\.?[0-9]*$/.test(raw)) return "Enter numbers only, e.g. 12500";
  const cents = parseAmountToCents(raw);
  if (cents === null || cents <= 0) return `Amount must be greater than ${NAIRA}0`;
  return "";
}

/** `2026-08-25` in the app, `25 Aug 2026` on screen. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** Today in the local timezone as `YYYY-MM-DD` — never `toISOString`, which is UTC. */
export function today(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toIsoDate(date);
}

export function startOfYear(iso = today()): string {
  return `${iso.slice(0, 4)}-01-01`;
}

export function startOfMonth(iso = today()): string {
  return `${iso.slice(0, 7)}-01`;
}

export function startOfQuarter(iso = today()): string {
  const month = Number(iso.slice(5, 7));
  const first = Math.floor((month - 1) / 3) * 3 + 1;
  return `${iso.slice(0, 4)}-${String(first).padStart(2, "0")}-01`;
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Credit/Debit card",
  check: "Check",
};

export function pluralise(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
