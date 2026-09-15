import type { ProfileType } from "./types";

/**
 * Brand theming. A business can recolour the app to its own brand; the personal book
 * always stays on the factory palette.
 *
 * The handoff flagged the prototype's theme as leaking across profiles. `resolveTheme`
 * takes the active profile type and returns the factory palette for `personal`, so the
 * leak cannot happen: there is no code path where a business colour reaches personal
 * surfaces.
 */

export interface BrandPreset {
  id: string;
  name: string;
  note: string;
  p: string;
  s: string;
  t: string;
}

export const BRAND_PRESETS: BrandPreset[] = [
  { id: "factory", name: "Dema default", note: "Factory theme", p: "#8FCB8D", s: "#F3A995", t: "#F6D9A9" },
  { id: "ink", name: "Deep ink", note: "Consulting, legal, finance", p: "#2F5AA8", s: "#E8894B", t: "#7C8FB5" },
  { id: "clay", name: "Warm clay", note: "Studios, agencies, retail", p: "#C4633F", s: "#3E7F6D", t: "#E3B84F" },
  { id: "orchid", name: "Orchid", note: "Beauty, events, lifestyle", p: "#7A4BC4", s: "#E4657F", t: "#F0B45C" },
];

export const FACTORY = BRAND_PRESETS[0];

export interface Theme {
  id: string;
  primary: string;
  secondary: string;
  tertiary: string;
  soft: string;
  edge: string;
  onPrimary: string;
  hover: string;
  pressed: string;
  contrastOnWhite: number;
  contrastOnLabel: number;
}

export interface ThemeChoice {
  id: string;
  count: 2 | 3;
  primary: string;
  secondary: string;
  tertiary: string;
}

function toRgb(hex: string): [number, number, number] {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = Number.parseInt(h.padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: number[]): string {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t));
}

function luminance(hex: string): number {
  const channels = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrast(a: string, b: string): number {
  const x = luminance(a) + 0.05;
  const y = luminance(b) + 0.05;
  return Math.max(x, y) / Math.min(x, y);
}

export function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/**
 * Builds the live palette. At two colours the third slot is generated from the primary,
 * which is what the "Accent (generated)" field shows.
 */
export function buildTheme(choice: ThemeChoice): Theme {
  const preset = BRAND_PRESETS.find((b) => b.id === choice.id);
  const primary = preset ? preset.p : choice.primary;
  const secondary = preset ? preset.s : choice.secondary;
  const chosenThird = preset ? preset.t : choice.tertiary;

  const tertiary = choice.count === 3 ? chosenThird : mix(primary, "#FFFFFF", 0.55);
  const factory = choice.id === "factory";
  const contrastOnWhite = contrast(primary, "#FFFFFF");
  const onPrimary = factory || contrastOnWhite >= 3 ? "#FFFFFF" : "#1A2B49";

  return {
    id: choice.id,
    primary,
    secondary,
    tertiary,
    // The factory soft and edge tints are literal brand values; every other theme
    // derives them from its primary so the whole palette stays in family.
    soft: factory ? "#D8ECD6" : mix(primary, "#FFFFFF", 0.66),
    edge: factory ? "#C7E4C5" : mix(primary, "#FFFFFF", 0.55),
    onPrimary,
    // Factory keeps the exact hover/press values from the design; other brands darken
    // their own primary by the same amount rather than borrowing factory's green.
    hover: factory ? "#7BBF79" : mix(primary, "#000000", 0.08),
    pressed: factory ? "#6BAE69" : mix(primary, "#000000", 0.16),
    contrastOnWhite,
    contrastOnLabel: contrast(primary, onPrimary),
  };
}

/** The theme actually in force, given which book is open. */
export function resolveTheme(
  choice: ThemeChoice,
  profileType: ProfileType | null,
): Theme {
  if (profileType !== "business") {
    return buildTheme({
      id: "factory",
      count: 3,
      primary: FACTORY.p,
      secondary: FACTORY.s,
      tertiary: FACTORY.t,
    });
  }
  return buildTheme(choice);
}

/** Writes the palette onto the document so every `bg-bp` / `text-on-bp` follows. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement.style;
  root.setProperty("--brand-primary", theme.primary);
  root.setProperty("--brand-secondary", theme.secondary);
  root.setProperty("--brand-tertiary", theme.tertiary);
  root.setProperty("--brand-soft", theme.soft);
  root.setProperty("--brand-edge", theme.edge);
  root.setProperty("--brand-on", theme.onPrimary);
  root.setProperty("--brand-hover", theme.hover);
  root.setProperty("--brand-pressed", theme.pressed);
}

export interface ContrastWarning {
  title: string;
  body: string;
}

/**
 * Warn-only, never blocking — a business is allowed to ship its real brand colour even
 * when it reads poorly. The factory theme is exempt.
 */
export function contrastWarning(theme: Theme): ContrastWarning | null {
  if (theme.id === "factory") return null;

  if (theme.contrastOnWhite < 1.6) {
    return {
      title: "Low contrast",
      body: `Primary ${theme.primary.toUpperCase()} sits at ${theme.contrastOnWhite.toFixed(
        2,
      )}:1 against white cards — buttons and pills will read as near-white shapes. Pick something deeper.`,
    };
  }
  if (theme.contrastOnLabel < 3) {
    return {
      title: "Low contrast",
      body: `Primary ${theme.primary.toUpperCase()} gives its labels only ${theme.contrastOnLabel.toFixed(
        1,
      )}:1 — below the 3:1 minimum. Button and nav text will be hard to read.`,
    };
  }
  return null;
}

/**
 * Categories store a literal hex, except the seeded income category which stores the
 * sentinel `brand` so it tracks whatever the business's primary happens to be.
 */
export function resolveTint(color: string): string {
  return color === "brand" ? "var(--brand-soft)" : color;
}
