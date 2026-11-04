"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import type { ActionResult } from "@/lib/action";

/** Runs a (bound) server action after confirmation. With `reasonLabel` the user must type a reason, passed as the last argument. */
export function ActionButton({ action, children, confirmTitle, confirmText, reasonLabel, inputLabel, inputType, destructive, redirectTo, ...btn }: {
  action: (value?: string) => Promise<ActionResult<unknown>>; // bound server action; receives typed value when reasonLabel/inputLabel set
  children: React.ReactNode;
  confirmTitle?: string;
  confirmText?: string;
  reasonLabel?: string;
  inputLabel?: string;
  inputType?: string;
  destructive?: boolean;
  redirectTo?: string | ((data: unknown) => string | undefined);
} & Omit<ButtonProps, "action">) {
  const router = useRouter();
  const run = async (value?: string) => {
    const res = await action(value);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(res.message ?? "Done");
    const to = typeof redirectTo === "function" ? redirectTo(res.data) : redirectTo;
    if (to) router.push(to);
    router.refresh();
  };
  return (
    <ConfirmDialog
      trigger={<Button variant={destructive ? "destructive" : btn.variant ?? "outline"} size={btn.size ?? "sm"} className={btn.className}>{children}</Button>}
      title={confirmTitle ?? "Are you sure?"}
      description={confirmText}
      reasonLabel={reasonLabel}
      inputLabel={inputLabel}
      inputType={inputType}
      destructive={destructive}
      onConfirm={run}
    />
  );
}
