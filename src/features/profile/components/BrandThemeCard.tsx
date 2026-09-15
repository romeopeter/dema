import { WarnIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/controls";
import { Pill } from "@/components/ui/pill";
import {
  BRAND_PRESETS,
  buildTheme,
  contrastWarning,
  isHex,
  type ThemeChoice,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { themeChoice, useSettingsStore } from "@/store/settingsStore";

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="h-[34px] w-[34px] flex-none rounded-[11px] shadow-[inset_0_0_0_1.5px_rgba(26,43,73,0.10)]"
      style={{ background: color }}
    />
  );
}

function HexField({
  label,
  note,
  value,
  swatch,
  locked,
  onChange,
}: {
  label: string;
  note: string;
  value: string;
  swatch: string;
  locked?: boolean;
  onChange?: (next: string) => void;
}) {
  const invalid = !locked && !isHex(value);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-semibold">{label}</label>
      <div
        className={cn(
          "flex items-center gap-[10px] rounded-[14px] border-[1.5px] px-3 py-[10px]",
          locked
            ? "border-dashed border-hairline bg-divider"
            : invalid
              ? "border-alert bg-surface"
              : "border-line bg-surface",
        )}
      >
        <Swatch color={swatch} />
        {locked ? (
          <span className="text-[15px] font-semibold tracking-[0.04em] text-muted">
            {swatch.toUpperCase()}
          </span>
        ) : (
          <input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            spellCheck={false}
            className="w-full border-none bg-transparent text-[15px] font-semibold tracking-[0.04em] text-ink outline-none"
          />
        )}
      </div>
      <div className="text-[12px] text-muted">{note}</div>
    </div>
  );
}

/**
 * Business-only. Recolours buttons, links, nav active state, chart and category series,
 * pills, card accents and the invoice header — text, numbers and neutral greys never
 * change, which is why only three variables are exposed.
 */
export function BrandThemeCard() {
  const values = useSettingsStore((s) => s.values);
  const saveSettings = useSettingsStore((s) => s.save);

  const choice = themeChoice(values);
  const theme = buildTheme(choice);
  const warning = contrastWarning(theme);
  const custom = choice.id === "custom";

  function update(patch: Partial<ThemeChoice>) {
    const next = { ...choice, ...patch };
    void saveSettings({
      theme_id: next.id,
      theme_count: String(next.count),
      theme_primary: next.primary,
      theme_secondary: next.secondary,
      theme_tertiary: next.tertiary,
    });
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <CardTitle>Brand theme</CardTitle>
          <div className="max-w-[520px] text-[14px] text-pretty text-muted">
            Applies to buttons, links, nav, charts, pills, card accents and the
            invoice header. Business profile only — your personal book always
            stays on the Dema palette.
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Pill
            selected={choice.count === 2}
            onClick={() => update({ count: 2 })}
          >
            2 colours
          </Pill>
          <Pill
            selected={choice.count === 3}
            onClick={() => update({ count: 3 })}
          >
            3 colours
          </Pill>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {BRAND_PRESETS.map((preset) => {
          const selected = choice.id === preset.id;
          const third =
            choice.count === 3
              ? preset.t
              : buildTheme({
                  id: preset.id,
                  count: 2,
                  primary: preset.p,
                  secondary: preset.s,
                  tertiary: preset.t,
                }).tertiary;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                update({
                  id: preset.id,
                  primary: preset.p,
                  secondary: preset.s,
                  tertiary: preset.t,
                })
              }
              className={cn(
                "flex flex-col gap-3 rounded-[20px] border-[1.5px] bg-surface p-4 text-left transition-all duration-[180ms] ease-[var(--ease-standard)]",
                selected ? "border-bp shadow-lift" : "border-line hover:shadow-lift",
              )}
            >
              <div className="flex items-center gap-2">
                <Swatch color={preset.p} />
                <Swatch color={preset.s} />
                <Swatch color={third} />
                <span
                  className="ml-auto h-4 w-4 flex-none rounded-full bg-surface"
                  style={{
                    border: selected
                      ? "5px solid var(--brand-primary)"
                      : "1.5px solid #DADEE5",
                  }}
                />
              </div>
              <div className="flex flex-col gap-[2px]">
                <div className="font-display text-[15px] font-semibold text-ink">
                  {preset.name}
                </div>
                <div className="text-[12px] text-muted">{preset.note}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-[14px]">
        <Pill
          selected={custom}
          onClick={() =>
            update({
              id: "custom",
              // Seed the fields from whatever is on screen, so opening custom never
              // flips the app to an unrelated colour.
              primary: theme.primary,
              secondary: theme.secondary,
              tertiary: theme.tertiary,
            })
          }
        >
          Custom brand colours
        </Pill>
        <span className="text-[13px] text-muted">
          Paste your hex values from your brand guide.
        </span>
        <Button
          variant="quiet"
          size="xs"
          className="ml-auto font-display font-semibold text-muted hover:text-ink"
          onClick={() =>
            update({
              id: "factory",
              count: 3,
              primary: BRAND_PRESETS[0].p,
              secondary: BRAND_PRESETS[0].s,
              tertiary: BRAND_PRESETS[0].t,
            })
          }
        >
          Reset to factory
        </Button>
      </div>

      {custom ? (
        <div className="grid grid-cols-3 gap-4 rounded-[20px] border-[1.5px] border-line bg-subtle p-5">
          <HexField
            label="Primary"
            note="Buttons, links, nav active, income series."
            value={choice.primary}
            swatch={theme.primary}
            onChange={(primary) => update({ primary })}
          />
          <HexField
            label="Secondary"
            note="Expense series, status badges."
            value={choice.secondary}
            swatch={theme.secondary}
            onChange={(secondary) => update({ secondary })}
          />
          {choice.count === 3 ? (
            <HexField
              label="Tertiary"
              note="Used for card accents and the invoice header."
              value={choice.tertiary}
              swatch={theme.tertiary}
              onChange={(tertiary) => update({ tertiary })}
            />
          ) : (
            <HexField
              label="Accent (generated)"
              note="Derived from your primary, since you supplied two colours."
              value={theme.tertiary}
              swatch={theme.tertiary}
              locked
            />
          )}
        </div>
      ) : null}

      {warning ? (
        <div className="flex items-start gap-3 rounded-[18px] border-[1.5px] border-warn-line bg-warn-bg px-[18px] py-4">
          <span className="mt-px flex-none text-[#B4761B]">
            <WarnIcon size={20} />
          </span>
          <div className="flex flex-col gap-[2px]">
            <div className="text-[14px] font-semibold text-warn-title">
              {warning.title}
            </div>
            <div className="text-[13px] leading-5 text-pretty text-warn-body">
              {warning.body}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
