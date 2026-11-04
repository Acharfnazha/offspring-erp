"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface FilterDef { key: string; label: string; options: { value: string; label: string }[] }

export function FilterBar({ filters = [], placeholder = "Search…", exportEntity, dateRange, children }: {
  filters?: FilterDef[];
  placeholder?: string;
  exportEntity?: string;
  dateRange?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);

  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const active = filters.some((f) => sp.get(f.key)) || !!sp.get("q") || !!sp.get("from") || !!sp.get("to");

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <form onSubmit={(e) => { e.preventDefault(); push({ q }); }} className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (sp.get("q") ?? "") && push({ q })} placeholder={placeholder} aria-label="Search" className="h-9 w-full rounded-md border bg-card ps-8 pe-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" />
      </form>
      {filters.map((f) => (
        <select key={f.key} aria-label={f.label} value={sp.get(f.key) ?? ""} onChange={(e) => push({ [f.key]: e.target.value })} className="h-9 rounded-md border bg-card px-2.5 text-sm">
          <option value="">{f.label}: All</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {dateRange && (
        <>
          <input type="date" aria-label="From date" value={sp.get("from") ?? ""} onChange={(e) => push({ from: e.target.value })} className="h-9 rounded-md border bg-card px-2 text-sm" />
          <input type="date" aria-label="To date" value={sp.get("to") ?? ""} onChange={(e) => push({ to: e.target.value })} className="h-9 rounded-md border bg-card px-2 text-sm" />
        </>
      )}
      {active && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}><X />Clear</Button>
      )}
      <div className="ms-auto flex items-center gap-2">
        {children}
        {exportEntity && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download />Export</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><a href={`/api/export/${exportEntity}?format=csv&${sp.toString()}`}>CSV</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={`/api/export/${exportEntity}?format=xlsx&${sp.toString()}`}>Excel (.xlsx)</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
