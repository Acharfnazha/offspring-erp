"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action";

export interface QField { name: string; label: string; type?: "number" | "text" | "select" | "textarea" | "date" | "checkbox"; options?: { value: string; label: string }[]; defaultValue?: string; required?: boolean; help?: string; }

/** A small dialog form that calls a server action with a record of string values. */
export function ActionDialog({ trigger, title, description, fields, submitLabel = "Save", onSubmit, redirect, destructive }: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  fields: QField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<ActionResult<unknown>>;
  redirect?: (data: unknown) => string | undefined;
  destructive?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const init = () => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === "select" ? f.options?.[0]?.value ?? "" : "")]));
  const [values, setValues] = useState<Record<string, string>>(init);
  const missing = fields.some((f) => f.required && !values[f.name]?.trim());
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setValues(init()); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const res = await onSubmit(values);
              if (!res.ok) { toast.error(res.error); return; }
              toast.success(res.message ?? "Done");
              setOpen(false);
              const to = redirect?.(res.data);
              if (to) router.push(to);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values[f.name] === "true"} onChange={(e) => setValues({ ...values, [f.name]: String(e.target.checked) })} />{f.label}</label>
              ) : (
                <>
                  <Label htmlFor={`qd-${f.name}`}>{f.label}</Label>
                  {f.type === "select" ? (
                    <NativeSelect id={`qd-${f.name}`} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </NativeSelect>
                  ) : f.type === "textarea" ? (
                    <Textarea id={`qd-${f.name}`} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                  ) : (
                    <Input id={`qd-${f.name}`} type={f.type ?? "text"} step="any" value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                  )}
                </>
              )}
              {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy || missing}>{busy && <Loader2 className="animate-spin" />}{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Button that runs a server action with confirmation and toasts. */
export function useActionRunner() {
  const router = useRouter();
  return async (fn: () => Promise<ActionResult<unknown>>, redirectTo?: (data: unknown) => string | undefined) => {
    const res = await fn();
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(res.message ?? "Done");
    const to = redirectTo?.(res.data);
    if (to) router.push(to);
    router.refresh();
  };
}
