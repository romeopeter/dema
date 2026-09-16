import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, Divider } from "@/components/ui/controls";
import { Label, OutlineInput, TextArea } from "@/components/ui/field";
import { mutate } from "@/lib/mutate";
import { getBusinessDetails, setBusinessDetails } from "@/lib/tauri";
import { useQuery } from "@/lib/useQuery";
import type { BusinessDetails } from "@/lib/types";
import { announce } from "@/store/uiStore";
import { useProfileStore } from "@/store/profileStore";

/**
 * Downscales a dropped image and re-encodes it as a PNG data URL.
 *
 * Invoices are printed, so the logo never needs more than a few hundred pixels, and a
 * phone photo straight off disk would be several megabytes sitting in the database and
 * re-serialised on every render. This caps it before it ever reaches Rust.
 */
async function toDataUrl(file: File, maxEdge: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/png");
}

function ImageField({
  label,
  hint,
  value,
  round,
  maxEdge,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  round?: boolean;
  maxEdge: number;
  onChange: (next: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await toDataUrl(file, maxEdge));
    } catch {
      announce("error", `Could not read that ${label.toLowerCase()}.`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[13px]">{label}</Label>
      <div className="flex items-center gap-4">
        <div
          className={`flex flex-none items-center justify-center overflow-hidden bg-surface shadow-[inset_0_0_0_1.5px_#E4E6EB] ${
            round ? "h-16 w-16 rounded-full" : "h-16 w-[140px] rounded-[14px]"
          }`}
        >
          {value ? (
            <img
              src={value}
              alt=""
              className={`h-full w-full ${round ? "object-cover" : "object-contain p-2"}`}
            />
          ) : (
            <span className="text-[11px] text-faint">None</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => input.current?.click()}
            >
              {value ? "Replace" : "Upload"}
            </Button>
            {value ? (
              <Button variant="danger" size="xs" onClick={() => onChange(null)}>
                Remove
              </Button>
            ) : null}
          </div>
          <div className="text-[12px] text-muted">{hint}</div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * The issuer half of every invoice. Business profile only — a personal book never bills
 * anyone, so none of this exists there.
 */
export function BusinessDetailsCard() {
  const profileId = useProfileStore((s) => s.activeProfileId);
  const query = useQuery<BusinessDetails>(
    () => getBusinessDetails(profileId!),
    [profileId],
    { enabled: profileId !== null },
  );

  const [form, setForm] = useState<BusinessDetails | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  if (!form) return null;

  const field = (key: keyof BusinessDetails) => ({
    value: (form[key] as string | null) ?? "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm({ ...form, [key]: e.target.value }),
  });

  const dirty = JSON.stringify(form) !== JSON.stringify(query.data);

  async function save() {
    if (!form) return;
    setBusy(true);
    await mutate(() => setBusinessDetails(form), {
      success: "Business details saved.",
    });
    setBusy(false);
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <CardTitle>Business details</CardTitle>
          <div className="max-w-[560px] text-[14px] text-pretty text-muted">
            These print on every invoice. The document reads them at render time, so
            fixing the address here corrects future invoices without touching the ones
            you have already sent.
          </div>
        </div>
        <Button size="sm" disabled={busy || !dirty} onClick={save}>
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">Address</Label>
          <TextArea {...field("address")} rows={2} placeholder="Street, city, state" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">Email</Label>
            <OutlineInput {...field("email")} placeholder="hello@example.ng" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">Phone</Label>
            <OutlineInput {...field("phone")} placeholder="+234 800 000 0000" />
          </div>
        </div>
      </div>

      <Divider className="bg-divider" />

      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">Bank</Label>
          <OutlineInput {...field("bankName")} placeholder="Guaranty Trust Bank" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">Account name</Label>
          <OutlineInput {...field("accountName")} placeholder="Registered name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">Account number</Label>
          <OutlineInput {...field("accountNumber")} placeholder="0000000000" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[13px]" optional>
          Payment instruction
        </Label>
        <TextArea
          {...field("paymentInstruction")}
          rows={2}
          placeholder="Transfer the amount to the business account below. Please include the invoice number as your payment reference."
        />
      </div>

      <Divider className="bg-divider" />

      <div className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <ImageField
          label="Logo"
          hint="Square image, printed as a 92px circle."
          value={form.logoDataUrl}
          round
          maxEdge={512}
          onChange={(logoDataUrl) => setForm({ ...form, logoDataUrl })}
        />
        <ImageField
          label="Signature"
          hint="Scan on a transparent or white background."
          value={form.signatureDataUrl}
          maxEdge={600}
          onChange={(signatureDataUrl) =>
            setForm({ ...form, signatureDataUrl })
          }
        />
      </div>

      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">Signer name</Label>
          <OutlineInput {...field("signerName")} placeholder="Who signs" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">Signer role</Label>
          <OutlineInput {...field("signerRole")} placeholder="Managing Director" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">RC number</Label>
          <OutlineInput {...field("rcNumber")} placeholder="1842093" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-[13px]">TIN</Label>
          <OutlineInput {...field("tin")} placeholder="20841776-0001" />
        </div>
      </div>
    </Card>
  );
}
