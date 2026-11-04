"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["month", "This month"], ["year", "This year"], ["custom", "Custom"]] as const;

export function RangeFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-lg border bg-card p-0.5">
        {RANGES.map(([k, l]) => (
          <button key={k} onClick={() => set({ range: k })} className={cn("rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground", current === k && "bg-primary text-primary-foreground hover:text-primary-foreground")}>
            {l}
          </button>
        ))}
      </div>
      {current === "custom" && (
        <div className="flex items-center gap-1">
          <input type="date" aria-label="From" defaultValue={sp.get("from") ?? ""} onChange={(e) => e.target.value && set({ range: "custom", from: e.target.value })} className="h-8 rounded-md border bg-card px-2 text-xs" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" aria-label="To" defaultValue={sp.get("to") ?? ""} onChange={(e) => e.target.value && set({ range: "custom", to: e.target.value })} className="h-8 rounded-md border bg-card px-2 text-xs" />
        </div>
      )}
    </div>
  );
}
