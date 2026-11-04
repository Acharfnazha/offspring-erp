import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Kpi({ label, value, sub, delta, icon, invert, href }: { label: string; value: string; sub?: string; delta?: number | null; icon?: React.ReactNode; invert?: boolean; href?: string }) {
  const good = delta === null || delta === undefined ? null : invert ? delta < 0 : delta > 0;
  const body = (
    <Card className={cn("p-4 transition-shadow", href && "hover:shadow-md")}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {icon && <div className="rounded-md bg-primary/10 p-1.5 text-primary [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</div>}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight tabular sm:text-2xl">{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {delta !== undefined && delta !== null && (
          <span className={cn("inline-flex items-center gap-0.5 rounded px-1 font-medium", good ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : delta === 0 ? "bg-muted text-muted-foreground" : "bg-red-500/10 text-red-600")}>
            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : delta < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="truncate text-muted-foreground">{sub}</span>}
      </div>
    </Card>
  );
  return href ? <a href={href}>{body}</a> : body;
}

export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}
