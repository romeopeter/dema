import { useEffect, useState } from "react";

import { BriefcaseIcon, PersonIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Divider, RadioDot, Switch } from "@/components/ui/controls";
import { OutlineInput } from "@/components/ui/field";
import { BrandThemeCard } from "@/features/profile/components/BrandThemeCard";
import { BusinessDetailsCard } from "@/features/profile/components/BusinessDetailsCard";
import { CategoriesCard } from "@/features/profile/components/CategoriesCard";
import { mutate } from "@/lib/mutate";
import { renameProfile } from "@/lib/tauri";
import type { ProfileType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveProfile, useProfileStore } from "@/store/profileStore";
import { readBool, useSettingsStore } from "@/store/settingsStore";

function ProfileRow({
  type,
  name,
  active,
  onSelect,
}: {
  type: ProfileType;
  name: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-4 rounded-[20px] border-[1.5px] bg-surface px-5 py-[18px] text-left transition-all duration-200 ease-[var(--ease-standard)]",
        active ? "border-bp shadow-card" : "border-line hover:border-faint",
      )}
    >
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] text-ink"
        style={{
          background:
            type === "business" ? "var(--brand-tertiary)" : "var(--brand-soft)",
        }}
      >
        {type === "business" ? (
          <BriefcaseIcon size={20} />
        ) : (
          <PersonIcon size={20} />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="text-[15px] font-semibold">
          {type === "business" ? "Business" : "Personal"}
        </span>
        <span className="truncate text-[13px] text-muted">{name}</span>
      </span>
      <RadioDot on={active} className="ml-auto" />
    </button>
  );
}

export function Settings() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeProfileId);
  const setActive = useProfileStore((s) => s.setActive);
  const addProfile = useProfileStore((s) => s.addProfile);
  const active = useActiveProfile();

  const values = useSettingsStore((s) => s.values);
  const saveSettings = useSettingsStore((s) => s.save);

  const missing: ProfileType | null = profiles.some(
    (p) => p.type === "personal",
  )
    ? profiles.some((p) => p.type === "business")
      ? null
      : "business"
    : "personal";

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfileName(active?.name ?? "");
  }, [active?.id, active?.name]);

  async function add() {
    if (!missing || newName.trim() === "") return;
    setBusy(true);
    const created = await mutate(() => addProfile(missing, newName.trim()), {
      success: `${missing === "business" ? "Business" : "Personal"} profile added.`,
    });
    setBusy(false);
    if (created) {
      setAdding(false);
      setNewName("");
    }
  }

  async function rename() {
    if (!active || profileName.trim() === "" || profileName === active.name)
      return;
    setBusy(true);
    await mutate(
      async () => {
        const updated = await renameProfile(active.id, profileName.trim());
        // The store holds the profile list, so it has to hear about the change.
        await useProfileStore.getState().load();
        return updated;
      },
      { success: "Profile renamed." },
    );
    setBusy(false);
  }

  return (
    <div className="scroll-area flex h-full flex-col gap-[22px] px-10 py-8">
      <header className="flex flex-col gap-1">
        <div className="text-[15px] text-muted">
          {active?.type === "business" ? "Business" : "Personal"} profile active
        </div>
        <h1 className="m-0 font-display text-[32px] leading-[38px] font-bold">
          Settings
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <Card className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1">
            <CardTitle>Active profile</CardTitle>
            <div className="text-[13px] text-pretty text-muted">
              {missing
                ? "Add the second profile to keep the two sets of books apart."
                : "Switching here changes every scoped view — dashboard, categories and transactions."}
            </div>
          </div>

          {profiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              type={profile.type}
              name={profile.name}
              active={profile.id === activeId}
              onSelect={() => void setActive(profile.id)}
            />
          ))}

          {missing && !adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-[14px] rounded-[20px] border-[1.5px] border-dashed border-line px-5 py-4 text-left transition-colors hover:border-bp hover:bg-subtle"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-divider text-muted">
                <PlusIcon size={20} />
              </span>
              <span className="flex flex-col gap-[2px]">
                <span className="text-[15px] font-semibold">
                  Add {missing === "business" ? "Business" : "Personal"} profile
                </span>
                <span className="text-[13px] text-muted">
                  {missing === "business"
                    ? "Adds invoicing, clients and brand theme"
                    : "Keeps personal spending out of your books"}
                </span>
              </span>
            </button>
          ) : null}

          {missing && adding ? (
            <div className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-dashed border-bp bg-subtle p-5">
              <label className="text-[13px] font-semibold">
                {missing === "business" ? "Business name" : "Your name"}
              </label>
              <OutlineInput
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={
                  missing === "business" ? "e.g. Duowork Ltd" : "e.g. David"
                }
              />
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="xs"
                  className="flex-1"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="xs"
                  className="flex-1"
                  disabled={busy || newName.trim() === ""}
                  onClick={add}
                >
                  Add profile
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-[18px]">
          <CardTitle>Preferences</CardTitle>

          <div className="flex flex-col gap-2 py-[6px]">
            <div className="text-[15px] font-medium">Profile name</div>
            <div className="flex gap-3">
              <OutlineInput
                className="flex-1"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                onBlur={rename}
              />
              <Button
                variant="secondary"
                size="xs"
                disabled={busy || profileName.trim() === active?.name}
                onClick={rename}
              >
                Save
              </Button>
            </div>
            <div className="text-[13px] text-muted">
              Used for the dashboard greeting and on your reports.
            </div>
          </div>

          <Divider className="bg-divider" />

          <div className="flex items-center justify-between py-[6px]">
            <div className="flex flex-col gap-[2px]">
              <div className="text-[15px] font-medium">Currency</div>
              <div className="text-[13px] text-muted">Naira (₦)</div>
            </div>
            <div className="rounded-full bg-divider px-[18px] py-[9px] text-[14px] font-medium">
              NGN
            </div>
          </div>

          <Divider className="bg-divider" />

          <div className="flex items-center justify-between py-[6px]">
            <div className="flex flex-col gap-[2px]">
              <div className="text-[15px] font-medium">
                Remind me about drafts
              </div>
              <div className="text-[13px] text-muted">
                Keeps unposted transactions in the notification panel
              </div>
            </div>
            <Switch
              label="Remind me about drafts"
              checked={readBool(values, "remind_drafts", true)}
              onChange={(next) =>
                void saveSettings({ remind_drafts: String(next) })
              }
            />
          </div>

          <Divider className="bg-divider" />

          <div className="flex items-center justify-between py-[6px]">
            <div className="flex flex-col gap-[2px]">
              <div className="text-[15px] font-medium">Start week on Monday</div>
              <div className="text-[13px] text-muted">
                Affects the Weekly period filter
              </div>
            </div>
            <Switch
              label="Start week on Monday"
              checked={readBool(values, "week_start_monday", false)}
              onChange={(next) =>
                void saveSettings({ week_start_monday: String(next) })
              }
            />
          </div>
        </Card>
      </div>

      {active?.type === "business" ? <BusinessDetailsCard /> : null}

      {active?.type === "business" ? <BrandThemeCard /> : null}

      <CategoriesCard />
    </div>
  );
}
