"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORM_SCHEMAS, type FormSchemaName } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "email" | "select" | "textarea" | "tel" | "url";
  options?: { value: string; label: string }[];
  placeholder?: string;
  span?: 1 | 2 | 3;
  step?: string;
  help?: string;
  section?: string;
}

export function EntityForm({ schema, fields, defaultValues, action, submitLabel = "Save", redirectTo, onDone, cols = 2 }: {
  schema: FormSchemaName;
  fields: FieldDef[];
  defaultValues: Record<string, unknown>;
  action: (values: unknown) => Promise<ActionResult<{ id: string } | void>>;
  submitLabel?: string;
  /** e.g. "/customers/:id" — ":id" is replaced with the created/updated id */
  redirectTo?: string;
  onDone?: () => void;
  cols?: 1 | 2 | 3;
}) {
  const router = useRouter();
  const form = useForm({ resolver: zodResolver(FORM_SCHEMAS[schema]), defaultValues });
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = form;

  const onSubmit = async (values: unknown) => {
    const res = await action(values);
    if (!res.ok) {
      toast.error(res.error);
      if (res.fieldErrors) for (const [k, v] of Object.entries(res.fieldErrors)) setError(k as never, { message: v });
      return;
    }
    toast.success(res.message ?? "Saved");
    onDone?.();
    const id = res.data && typeof res.data === "object" && "id" in res.data ? (res.data as { id: string }).id : "";
    if (redirectTo) router.push(redirectTo.replace(":id", id));
    router.refresh();
  };

  let lastSection: string | undefined;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className={cn("grid gap-4", cols === 1 ? "grid-cols-1" : cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
        {fields.map((f) => {
          const err = (errors as Record<string, { message?: string }>)[f.name]?.message;
          const showSection = f.section && f.section !== lastSection;
          lastSection = f.section ?? lastSection;
          const span = f.span === 3 ? "sm:col-span-2 lg:col-span-3" : f.span === 2 ? "sm:col-span-2" : "";
          return (
            <div key={f.name} className={cn("contents")}>
              {showSection && <div className="col-span-full mt-2 border-b pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.section}</div>}
              <div className={cn("space-y-1.5", span)}>
                <Label htmlFor={f.name}>{f.label}</Label>
                {f.type === "select" ? (
                  <NativeSelect id={f.name} {...register(f.name)} aria-invalid={!!err}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </NativeSelect>
                ) : f.type === "textarea" ? (
                  <Textarea id={f.name} {...register(f.name)} placeholder={f.placeholder} aria-invalid={!!err} />
                ) : (
                  <Input id={f.name} type={f.type ?? "text"} step={f.step ?? (f.type === "number" ? "any" : undefined)} {...register(f.name)} placeholder={f.placeholder} aria-invalid={!!err} />
                )}
                {f.help && !err && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
                {err && <p className="text-[11px] text-red-600">{err}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => (onDone ? onDone() : router.back())}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}{submitLabel}</Button>
      </div>
    </form>
  );
}
