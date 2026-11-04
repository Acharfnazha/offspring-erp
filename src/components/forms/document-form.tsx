"use client";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FORM_SCHEMAS, type FormSchemaName } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";
import type { FieldDef } from "./entity-form";
import { cn } from "@/lib/utils";

export interface LineCol { name: string; label: string; type?: "text" | "number" | "select"; options?: { value: string; label: string }[]; width?: string; onSelectFill?: Record<string, Record<string, string | number>> }

export function DocumentForm({ schema, header, lineCols, defaultValues, newLine, action, redirectTo, submitLabel = "Save", qtyKey = "quantityKg", priceKey = "unitPrice", taxKey, discountKey = "discountPct", headerDiscountKey, currencyKey = "currency", extraSubmit }: {
  schema: FormSchemaName;
  header: FieldDef[];
  lineCols: LineCol[];
  defaultValues: Record<string, unknown>;
  newLine: Record<string, unknown>;
  action: (values: unknown) => Promise<ActionResult<unknown>>;
  redirectTo?: string;
  submitLabel?: string;
  qtyKey?: string;
  priceKey?: string;
  taxKey?: string;
  discountKey?: string;
  headerDiscountKey?: string;
  currencyKey?: string;
  extraSubmit?: { label: string; flag: string };
}) {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(FORM_SCHEMAS[schema]), defaultValues });
  const { register, control, handleSubmit, setValue, formState: { errors, isSubmitting } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" as never });
  const items = (useWatch({ control, name: "items" as never }) as unknown as Record<string, unknown>[]) ?? [];
  const headerDiscount = useWatch({ control, name: (headerDiscountKey ?? "__none") as never }) as unknown as string;
  const currency = (useWatch({ control, name: currencyKey as never }) as unknown as string) || "USD";

  const num = (v: unknown) => { try { return new Decimal(String(v ?? "") || 0); } catch { return new Decimal(0); } };
  let subtotal = new Decimal(0), disc = new Decimal(0), tax = new Decimal(0);
  const lineTotals = items.map((l) => {
    const gross = num(l[qtyKey]).mul(num(l[priceKey])).toDecimalPlaces(2);
    const d = gross.mul(num(l[discountKey])).div(100).toDecimalPlaces(2);
    const t = taxKey ? gross.minus(d).mul(num(l[taxKey])).div(100).toDecimalPlaces(2) : new Decimal(0);
    subtotal = subtotal.plus(gross); disc = disc.plus(d); tax = tax.plus(t);
    return gross.minus(d).plus(t);
  });
  const hd = headerDiscountKey ? num(headerDiscount) : new Decimal(0);
  const total = subtotal.minus(disc).minus(hd).plus(tax);
  const fmt = (d: Decimal) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(d.toNumber()); } catch { return `${currency} ${d.toFixed(2)}`; } };
  const err = (k: string) => (errors as Record<string, { message?: string }>)[k]?.message;
  const itemsErr = (errors as { items?: { message?: string; root?: { message?: string } } & Record<number, Record<string, { message?: string }>> }).items;

  const submit = (flag?: string) => handleSubmit(async (values) => {
    const res = await action(flag ? { ...(values as object), [flag]: true } : values);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(res.message ?? "Saved");
    const id = res.data && typeof res.data === "object" && "id" in res.data ? (res.data as { id: string }).id : "";
    if (redirectTo) router.push(redirectTo.replace(":id", id));
    router.refresh();
  });

  return (
    <form onSubmit={submit()} noValidate className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {header.map((f) => (
            <div key={f.name} className={cn("space-y-1.5", f.span === 2 && "sm:col-span-2", f.span === 3 && "sm:col-span-2 lg:col-span-4")}>
              <Label htmlFor={f.name}>{f.label}</Label>
              {f.type === "select" ? (
                <NativeSelect id={f.name} {...register(f.name as never)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
              ) : f.type === "textarea" ? (
                <Textarea id={f.name} {...register(f.name as never)} placeholder={f.placeholder} />
              ) : (
                <Input id={f.name} type={f.type ?? "text"} step="any" {...register(f.name as never)} placeholder={f.placeholder} />
              )}
              {f.help && !err(f.name) && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
              {err(f.name) && <p className="text-[11px] text-red-600">{err(f.name)}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Line items</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => append(newLine as never)}><Plus />Add line</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, idx) => (
            <div key={f.id} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 md:grid-cols-12">
              {lineCols.map((c) => {
                const name = `items.${idx}.${c.name}`;
                const e = itemsErr?.[idx]?.[c.name]?.message;
                return (
                  <div key={c.name} className={cn("space-y-1", c.width ?? "md:col-span-2")}>
                    <Label className="text-[10px]">{c.label}</Label>
                    {c.type === "select" ? (
                      <NativeSelect {...register(name as never, { onChange: (ev) => { const fill = c.onSelectFill?.[ev.target.value]; if (fill) for (const [k, v] of Object.entries(fill)) setValue(`items.${idx}.${k}` as never, v as never); } })}>
                        {c.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </NativeSelect>
                    ) : (
                      <Input type={c.type ?? "text"} step="any" {...register(name as never)} aria-invalid={!!e} />
                    )}
                    {e && <p className="text-[10px] text-red-600">{e}</p>}
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-2 md:col-span-1 md:flex-col md:items-end">
                <span className="text-xs font-medium tabular">{fmt(lineTotals[idx] ?? new Decimal(0))}</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(idx)} disabled={fields.length === 1} aria-label="Remove line"><Trash2 /></Button>
              </div>
            </div>
          ))}
          {(itemsErr?.message || itemsErr?.root?.message) && <p className="text-xs text-red-600">{itemsErr.message ?? itemsErr.root?.message}</p>}
          <div className="ms-auto w-full max-w-xs space-y-1 pt-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{fmt(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discounts</span><span className="tabular">−{fmt(disc.plus(hd))}</span></div>
            {taxKey && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular">{fmt(tax)}</span></div>}
            <div className="flex justify-between border-t pt-1 text-base font-semibold"><span>Total</span><span className="tabular">{fmt(total)}</span></div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        {extraSubmit && <Button type="button" variant="secondary" disabled={isSubmitting} onClick={submit(extraSubmit.flag)}>{extraSubmit.label}</Button>}
        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}{submitLabel}</Button>
      </div>
    </form>
  );
}
