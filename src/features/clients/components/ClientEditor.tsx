import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/controls";
import { Label, TextArea, TextInput } from "@/components/ui/field";
import { mutate } from "@/lib/mutate";
import { createClient, deleteClient, updateClient } from "@/lib/tauri";
import type { Client } from "@/lib/types";
import { useProfileStore } from "@/store/profileStore";

const BLANK = { name: "", email: "", phone: "", address: "", notes: "" };

/**
 * Edits the selected client, or captures a new one when `client` is null. Deleting is
 * offered only while a client has no invoices — the command refuses otherwise, and the
 * message says why.
 */
export function ClientEditor({
  client,
  onDone,
}: {
  client: Client | null;
  onDone: (client: Client | null) => void;
}) {
  const profileId = useProfileStore((s) => s.activeProfileId);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(
      client
        ? {
            name: client.name,
            email: client.email ?? "",
            phone: client.phone ?? "",
            address: client.address ?? "",
            notes: client.notes ?? "",
          }
        : BLANK,
    );
  }, [client]);

  const field = (key: keyof typeof BLANK) => ({
    value: form[key],
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  async function save() {
    if (!profileId || form.name.trim() === "") return;
    setBusy(true);
    const input = { profileId, ...form };
    const saved = client
      ? await mutate(() => updateClient(client.id, input), {
          success: "Client updated.",
        })
      : await mutate(() => createClient(input), { success: "Client added." });
    setBusy(false);
    if (saved) onDone(saved);
  }

  async function remove() {
    if (!client) return;
    setBusy(true);
    const done = await mutate(() => deleteClient(client.id), {
      success: `${client.name} removed.`,
    });
    setBusy(false);
    if (done !== null) onDone(null);
  }

  return (
    <Card className="scroll-area flex flex-col gap-5 shadow-card">
      <CardTitle>{client ? "Edit client" : "New client"}</CardTitle>

      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">Name</Label>
        <TextInput {...field("name")} placeholder="Business or person" />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">Email</Label>
        <TextInput {...field("email")} placeholder="accounts@example.ng" />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">Phone</Label>
        <TextInput {...field("phone")} placeholder="0803 000 0000" />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[13px]">Address</Label>
        <TextArea {...field("address")} rows={2} placeholder="Street, city, state" />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[13px]" optional>
          Notes
        </Label>
        <TextArea {...field("notes")} rows={2} placeholder="Payment terms, quirks" />
      </div>

      <div className="mt-auto flex gap-3 pt-2">
        {client ? (
          <Button
            variant="danger"
            className="flex-1"
            size="sm"
            disabled={busy}
            onClick={remove}
          >
            Delete
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="flex-1"
            size="sm"
            disabled={busy}
            onClick={() => onDone(null)}
          >
            Cancel
          </Button>
        )}
        <Button
          className="flex-1"
          size="sm"
          disabled={busy || form.name.trim() === ""}
          onClick={save}
        >
          {client ? "Save client" : "Add client"}
        </Button>
      </div>
    </Card>
  );
}
