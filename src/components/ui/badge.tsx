import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/10 text-primary dark:bg-primary/20",
      success: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      warning: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
      danger: "border-transparent bg-red-500/10 text-red-700 dark:text-red-400",
      info: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400",
      muted: "border-transparent bg-muted text-muted-foreground",
      outline: "text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  AVAILABLE: "success", RESERVED: "info", DEPLETED: "muted", QUARANTINE: "warning", SPOILED: "danger",
  DRAFT: "muted", SENT: "info", ACCEPTED: "success", REJECTED: "danger", EXPIRED: "warning", CONVERTED: "default",
  CONFIRMED: "info", PARTIALLY_FULFILLED: "warning", FULFILLED: "success", CANCELLED: "danger",
  ISSUED: "info", PARTIALLY_PAID: "warning", PAID: "success", OVERDUE: "danger",
  PENDING: "warning", APPROVED: "success",
  PLANNING: "muted", PACKING: "info", READY_FOR_DISPATCH: "info", IN_TRANSIT: "default", ARRIVED: "info", DELIVERED: "success", COMPLETED: "success",
  OPERATIONAL: "success", MAINTENANCE: "warning", OFFLINE: "danger",
  ACTIVE: "success", CLOSED: "muted", RECEIVED: "success", PARTIALLY_RECEIVED: "warning",
  VOIDED: "danger",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{label ?? status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}
