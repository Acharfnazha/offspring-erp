"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSettingAction } from "./actions";

function useSave(key: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return { busy, save: async (v: unknown) => { setBusy(true); const r = await saveSettingAction(key, v); setBusy(false); if (!r.ok) toast.error(r.error); else { toast.success("Saved"); router.refresh(); } } };
}

export function KeyValueForm({ settingKey, value, fields, disabled }: { settingKey: string; value: Record<string, string | number>; fields: { name: string; label: string; type?: "text" | "number" | "textarea" | "select"; options?: string[]; help?: string }[]; disabled: boolean }) {
  const [v, setV] = useState(value);
  const { busy, save } = useSave(settingKey);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(v); }}>
      {fields.map((f) => (
        <div key={f.name} className={f.type === "textarea" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
          <Label htmlFor={`${settingKey}-${f.name}`}>{f.label}</Label>
          {f.type === "textarea" ? <Textarea id={`${settingKey}-${f.name}`} disabled={disabled} value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
            : f.type === "select" ? <NativeSelect id={`${settingKey}-${f.name}`} disabled={disabled} value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>{f.options?.map((o) => <option key={o}>{o}</option>)}</NativeSelect>
            : <Input id={`${settingKey}-${f.name}`} disabled={disabled} type={f.type ?? "text"} step="any" value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
          {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
        </div>
      ))}
      {!disabled && <div className="sm:col-span-2 flex justify-end"><Button disabled={busy}><Save />Save</Button></div>}
    </form>
  );
}

export function RatesForm({ value, disabled }: { value: Record<string, number>; disabled: boolean }) {
  const [rows, setRows] = useState(Object.entries(value).map(([c, r]) => ({ c, r: String(r) })));
  const { busy, save } = useSave("exchangeRates");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save(Object.fromEntries(rows.map((x) => [x.c.toUpperCase(), Number(x.r)]))); }}>
      <p className="text-xs text-muted-foreground">Units of currency per 1 USD. Manually maintained reference rates — not live market data.</p>
      {rows.map((x, i) => (
        <div key={i} className="flex gap-2">
          <Input aria-label="Currency" className="w-24" maxLength={3} disabled={disabled || x.c === "USD"} value={x.c} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, c: e.target.value.toUpperCase() } : y)))} />
          <Input aria-label="Rate" type="number" step="any" disabled={disabled || x.c === "USD"} value={x.r} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, r: e.target.value } : y)))} />
          {!disabled && x.c !== "USD" && <Button type="button" size="icon" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 /></Button>}
        </div>
      ))}
      {!disabled && <div className="flex justify-between"><Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { c: "", r: "" }])}><Plus />Currency</Button><Button disabled={busy}><Save />Save</Button></div>}
    </form>
  );
}

export function PackagingForm({ value, disabled }: { value: { cartonWeightKg: number; laborPerCarton: number; items: { name: string; costPerCarton: number }[] }; disabled: boolean }) {
  const [v, setV] = useState(value);
  const { busy, save } = useSave("packagingDefaults");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save(v); }}>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>Default carton (kg)</Label><Input type="number" step="any" disabled={disabled} value={v.cartonWeightKg} onChange={(e) => setV({ ...v, cartonWeightKg: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label>Packaging labor / carton</Label><Input type="number" step="any" disabled={disabled} value={v.laborPerCarton} onChange={(e) => setV({ ...v, laborPerCarton: Number(e.target.value) })} /></div>
      </div>
      {v.items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input aria-label="Item" disabled={disabled} value={it.name} onChange={(e) => setV({ ...v, items: v.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
          <Input aria-label="Cost per carton" className="w-28" type="number" step="any" disabled={disabled} value={it.costPerCarton} onChange={(e) => setV({ ...v, items: v.items.map((x, j) => (j === i ? { ...x, costPerCarton: Number(e.target.value) } : x)) })} />
          {!disabled && <Button type="button" size="icon" variant="ghost" onClick={() => setV({ ...v, items: v.items.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 /></Button>}
        </div>
      ))}
      {!disabled && <div className="flex justify-between"><Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, items: [...v.items, { name: "", costPerCarton: 0 }] })}><Plus />Item</Button><Button disabled={busy}><Save />Save</Button></div>}
    </form>
  );
}
