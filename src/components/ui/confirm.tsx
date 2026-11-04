"use client";
import * as React from "react";
import * as AD from "@radix-ui/react-alert-dialog";
import { Button } from "./button";
import { Input, Textarea } from "./input";
import { Label } from "./label";

interface ConfirmProps {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** When set, a reason textbox is shown and passed to onConfirm */
  reasonLabel?: string;
  inputLabel?: string;
  inputType?: string;
  onConfirm: (value?: string) => Promise<void> | void;
}

export function ConfirmDialog({ trigger, title, description, confirmLabel = "Confirm", destructive, reasonLabel, inputLabel, inputType = "text", onConfirm }: ConfirmProps) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [value, setValue] = React.useState("");
  const needsValue = !!(reasonLabel || inputLabel);
  return (
    <AD.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setValue(""); }}>
      <AD.Trigger asChild>{trigger}</AD.Trigger>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <AD.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-xl">
          <AD.Title className="text-base font-semibold">{title}</AD.Title>
          {description && <AD.Description className="text-sm text-muted-foreground">{description}</AD.Description>}
          {needsValue && (
            <div className="grid gap-1.5">
              <Label>{reasonLabel ?? inputLabel}</Label>
              {reasonLabel ? (
                <Textarea value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              ) : (
                <Input type={inputType} value={value} onChange={(e) => setValue(e.target.value)} autoFocus step="any" />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <AD.Cancel asChild>
              <Button variant="outline" disabled={busy}>Cancel</Button>
            </AD.Cancel>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={busy || (needsValue && !value.trim())}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm(needsValue ? value : undefined);
                  setOpen(false);
                  setValue("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
