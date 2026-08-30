import { useState } from "react";

import { CategoryGlyph, ICON_CHOICES, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/controls";
import { OutlineInput } from "@/components/ui/field";
import { SmallChoice } from "@/components/ui/pill";
import { useCategories } from "@/features/transactions/hooks";
import { pluralise } from "@/lib/format";
import { mutate } from "@/lib/mutate";
import {
  createCategory,
  deleteCategory,
  restoreCategory,
  setCategoryHidden,
} from "@/lib/tauri";
import { resolveTint } from "@/lib/theme";
import type { Category, Kind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProfileStore } from "@/store/profileStore";

const COLOUR_CHOICES = [
  "#F6D9A9",
  "brand",
  "#B8DCF0",
  "#F0C6D9",
  "#DDD4F0",
  "#C3EDE0",
  "#F0E3A9",
  "#DADEE5",
];

/**
 * Built-ins can be hidden and brought back; your own can be archived. Neither ever
 * deletes a row, so a transaction recorded two years ago keeps its category name,
 * icon and colour, and last year's tax report still reproduces exactly.
 */
export function CategoriesCard() {
  const profileId = useProfileStore((s) => s.activeProfileId);
  const categories = useCategories();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(ICON_CHOICES[0]);
  const [colour, setColour] = useState(COLOUR_CHOICES[0]);
  const [kind, setKind] = useState<Kind>("expense");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!profileId || name.trim() === "") return;
    setBusy(true);
    const made = await mutate(
      () =>
        createCategory({
          profileId,
          name: name.trim(),
          icon,
          color: colour,
          kind,
          taxDeductible: kind === "expense",
        }),
      { success: `“${name.trim()}” added.` },
    );
    setBusy(false);
    if (made) setName("");
  }

  async function toggle(category: Category) {
    if (!profileId) return;
    setBusy(true);

    if (category.isBuiltin) {
      await mutate(
        () => setCategoryHidden(category.id, profileId, !category.isHidden),
        {
          success: category.isHidden
            ? `${category.name} is back in the picker.`
            : `${category.name} hidden. Past transactions keep it.`,
        },
      );
    } else if (category.isDeleted) {
      await mutate(() => restoreCategory(category.id, profileId), {
        success: `${category.name} restored.`,
      });
    } else {
      await mutate(() => deleteCategory(category.id, profileId), {
        success:
          category.transactionCount > 0
            ? `${category.name} archived — its ${pluralise(category.transactionCount, "transaction")} are untouched.`
            : `${category.name} archived.`,
      });
    }

    setBusy(false);
  }

  return (
    <Card className="mb-8 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <CardTitle>Categories</CardTitle>
          <div className="text-[14px] text-muted">
            Built-ins can be hidden; your own can be archived. History is never
            deleted.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6 max-xl:grid-cols-1">
        <div className="grid grid-cols-3 content-start gap-3 max-lg:grid-cols-2">
          {categories.all.map((category) => {
            const gone = category.isHidden || category.isDeleted;
            return (
              <div
                key={category.id}
                className={cn(
                  "flex items-center gap-3 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-[14px]",
                  gone && "opacity-55",
                )}
              >
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px]"
                  style={{
                    background: gone ? "#ECEDF0" : resolveTint(category.color),
                  }}
                >
                  <CategoryGlyph icon={category.icon} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <div className="truncate text-[15px] font-medium">
                    {category.name}
                  </div>
                  <div className="text-[12px] text-muted">
                    {category.isDeleted
                      ? "Archived"
                      : category.isHidden
                        ? "Hidden"
                        : category.isBuiltin
                          ? "Built-in"
                          : "Custom"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(category)}
                  className={cn(
                    "rounded-full border border-line bg-surface px-[14px] py-[6px] text-[12px] font-semibold transition-colors hover:bg-divider",
                    gone ? "text-success" : "text-muted",
                  )}
                >
                  {gone ? "Restore" : category.isBuiltin ? "Hide" : "Archive"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 rounded-[20px] bg-divider p-6">
          <div className="font-display text-[17px] font-semibold">
            New category
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold">Name</label>
            <OutlineInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Subscriptions"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-label={choice}
                  onClick={() => setIcon(choice)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-[13px] border-[1.5px] bg-surface",
                    icon === choice ? "border-bp" : "border-line",
                  )}
                >
                  <CategoryGlyph icon={choice} size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold">Colour</label>
            <div className="flex flex-wrap gap-2">
              {COLOUR_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-label={`Colour ${choice}`}
                  onClick={() => setColour(choice)}
                  className="h-[34px] w-[34px] rounded-full"
                  style={{
                    background: resolveTint(choice),
                    border:
                      colour === choice
                        ? "2.5px solid var(--brand-primary)"
                        : "2.5px solid transparent",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold">Type</label>
            <div className="flex gap-2">
              <SmallChoice
                selected={kind === "expense"}
                onClick={() => setKind("expense")}
              >
                Expense
              </SmallChoice>
              <SmallChoice
                selected={kind === "income"}
                onClick={() => setKind("income")}
              >
                Income
              </SmallChoice>
            </div>
          </div>

          <Button
            className="mt-1"
            size="sm"
            disabled={busy || name.trim() === ""}
            onClick={create}
          >
            <PlusIcon size={16} />
            Create category
          </Button>
        </div>
      </div>
    </Card>
  );
}
