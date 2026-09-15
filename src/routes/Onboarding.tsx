import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { BothIcon, BriefcaseIcon, PersonIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RadioDot } from "@/components/ui/controls";
import { TextInput } from "@/components/ui/field";
import { mutate } from "@/lib/mutate";
import { cn } from "@/lib/utils";
import { useProfileStore } from "@/store/profileStore";

type Pick = "personal" | "business" | "both";

const CHOICES: {
  id: Pick;
  title: string;
  body: string;
  tint: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "personal",
    title: "Personal",
    body: "Everyday income and spending",
    tint: "var(--brand-soft)",
    icon: <PersonIcon size={22} />,
  },
  {
    id: "business",
    title: "Business",
    body: "Adds clients, invoices and a tax report",
    tint: "var(--brand-tertiary)",
    icon: <BriefcaseIcon size={22} />,
  },
  {
    id: "both",
    title: "Both",
    body: "Keep them separate, switch when you need to",
    tint: "#DDD4F0",
    icon: <BothIcon size={22} />,
  },
];

/**
 * The one place the initial profile choice is made. The prototype hardcoded the profile
 * names; a real ledger has to ask, so each pick reveals just the name fields it needs.
 */
export function Onboarding() {
  const navigate = useNavigate();
  const profiles = useProfileStore((s) => s.profiles);
  const loaded = useProfileStore((s) => s.loaded);
  const addProfile = useProfileStore((s) => s.addProfile);
  const setActive = useProfileStore((s) => s.setActive);

  const [pick, setPick] = useState<Pick>("both");
  const [personalName, setPersonalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);

  const needsPersonal = pick === "personal" || pick === "both";
  const needsBusiness = pick === "business" || pick === "both";
  const ready =
    (!needsPersonal || personalName.trim() !== "") &&
    (!needsBusiness || businessName.trim() !== "");

  // Onboarding is for a fresh ledger only; an existing one goes straight home.
  if (loaded && profiles.length > 0) return <Navigate to="/" replace />;

  async function finish() {
    setSaving(true);
    let personalId: number | null = null;
    let businessId: number | null = null;

    if (needsPersonal) {
      const created = await mutate(() =>
        addProfile("personal", personalName.trim()),
      );
      if (!created) return setSaving(false);
      personalId = created.id;
    }
    if (needsBusiness) {
      const created = await mutate(() =>
        addProfile("business", businessName.trim()),
      );
      if (!created) return setSaving(false);
      businessId = created.id;
    }

    // Business wins when both were created, matching what the design routes to.
    const active = businessId ?? personalId;
    if (active) await setActive(active);
    navigate("/", { replace: true });
  }

  return (
    <div className="grid h-full grid-cols-1 overflow-hidden bg-surface lg:grid-cols-2">
      <div className="scroll-area flex flex-col justify-center gap-10 px-20 py-18">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-bp font-display text-[20px] font-bold text-on-bp">
            D
          </div>
          <div className="font-display text-[22px] font-bold tracking-[0.04em]">
            Dema
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="m-0 font-display text-[40px] leading-[46px] font-bold">
            How will you use Dema?
          </h1>
          <p className="m-0 max-w-[420px] text-[16px] leading-6 text-pretty text-muted">
            Pick a profile to start with. You can add the other one any time from
            Settings.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {CHOICES.map((choice) => {
            const selected = pick === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => setPick(choice.id)}
                className={cn(
                  "flex items-center gap-4 rounded-[20px] border-[1.5px] bg-surface px-5 py-[18px] text-left transition-all duration-200 ease-[var(--ease-standard)]",
                  selected ? "border-bp shadow-card" : "border-line",
                )}
              >
                <span
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] text-ink"
                  style={{ background: choice.tint }}
                >
                  {choice.icon}
                </span>
                <span className="flex flex-col gap-[2px]">
                  <span className="text-[16px] font-semibold">
                    {choice.title}
                  </span>
                  <span className="text-[14px] text-muted">{choice.body}</span>
                </span>
                <RadioDot on={selected} className="ml-auto" />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          {needsPersonal ? (
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold">Your name</label>
              <TextInput
                value={personalName}
                onChange={(e) => setPersonalName(e.target.value)}
                placeholder="e.g. David"
                autoFocus
              />
            </div>
          ) : null}
          {needsBusiness ? (
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold">Business name</label>
              <TextInput
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Duowork Software Solutions"
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <Button
            size="lg"
            className="px-10 py-[15px] text-[17px]"
            disabled={!ready || saving}
            onClick={finish}
          >
            Continue
          </Button>
          <span className="text-[14px] text-faint">Takes a minute</span>
        </div>
      </div>

      <div className="relative hidden flex-col justify-center gap-5 overflow-hidden px-20 py-18 lg:flex">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/onboarding-bg.jpg')" }}
        />
        <div className="absolute inset-0 z-[1] bg-linear-[180deg,rgba(143,203,141,0.72)_0%,rgba(26,43,73,0.55)_100%]" />

        <div className="relative z-[2] flex flex-col gap-5 rounded-3xl bg-surface p-7 shadow-[0_8px_24px_rgba(26,43,73,0.16)]">
          <div className="text-[13px] font-semibold tracking-[0.08em] text-faint uppercase">
            This month
          </div>
          <div className="flex items-center gap-7">
            <div
              className="flex h-[132px] w-[132px] flex-none items-center justify-center rounded-full"
              style={{
                background:
                  "conic-gradient(var(--brand-primary) 0 68%, var(--brand-secondary) 68% 100%)",
              }}
            >
              <div className="h-[82px] w-[82px] rounded-full bg-surface" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center gap-2 text-[14px] text-muted">
                  <span className="h-[14px] w-1 rounded-full bg-bp" />
                  Income
                </div>
                <div className="tnum text-[26px] font-bold">₦620,000</div>
              </div>
              <div className="flex flex-col gap-[2px]">
                <div className="flex items-center gap-2 text-[14px] text-muted">
                  <span className="h-[14px] w-1 rounded-full bg-bs" />
                  Spent
                </div>
                <div className="tnum text-[26px] font-bold">₦268,400</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-[2] flex flex-col gap-[14px] rounded-3xl bg-surface px-7 py-6 shadow-[0_8px_24px_rgba(26,43,73,0.16)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[14px]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0E3A9]">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1A2B49"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M7 3h10v18l-2.5-2-2.5 2-2.5-2L7 21z" />
                  <path d="M10 9h4M10 13h4" />
                </svg>
              </span>
              <div className="font-medium">Invoice #DW-014</div>
            </div>
            <div className="tnum text-[18px] font-bold text-success">
              +₦850,000
            </div>
          </div>
          <div className="text-[13px] text-pretty text-muted">
            Mark an invoice paid and Dema posts the matching income transaction
            for you.
          </div>
        </div>

        <div className="absolute right-0 bottom-7 left-0 z-[2] flex items-center justify-center gap-[10px]">
          <img
            src="/duowork-appicon.png"
            alt=""
            className="block h-6 w-6 rounded-[7px]"
          />
          <span className="text-[13px] font-medium tracking-[0.02em] text-white/92">
            Expense manager by Duowork
          </span>
        </div>
      </div>
    </div>
  );
}
