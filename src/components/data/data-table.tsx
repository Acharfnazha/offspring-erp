"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ColType = "text" | "money" | "kg" | "number" | "date" | "badge" | "pct" | "mono";
export interface Col {
  key: string;
  header: string;
  type?: ColType;
  sortKey?: string; // server sort key; omit → not sortable
  align?: "start" | "end";
  className?: string;
  hideOnMobile?: boolean;
}
export type Row = Record<string, string | number | null | undefined> & { _href?: string; _id?: string };

const fmtMoney = (v: string, cur = "USD") => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n); } catch { return `${cur} ${n.toFixed(2)}`; }
};

function renderCell(col: Col, row: Row) {
  const raw = row[col.key];
  if (raw === null || raw === undefined || raw === "") return <span className="text-muted-foreground">—</span>;
  const v = String(raw);
  switch (col.type) {
    case "money": return <span className="tabular">{fmtMoney(v, (row._currency as string) || "USD")}</span>;
    case "kg": return <span className="tabular">{Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })} kg</span>;
    case "number": return <span className="tabular">{Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>;
    case "pct": return <span className="tabular">{Number(v).toFixed(1)}%</span>;
    case "date": return <span className="tabular whitespace-nowrap">{new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</span>;
    case "badge": return <StatusBadge status={v} />;
    case "mono": return <span className="font-mono text-xs">{v}</span>;
    default: return v;
  }
}

export function DataTable({ columns, rows, total, page, pageSize, emptyTitle = "No records yet", emptyHint, emptyAction }: {
  columns: Col[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const sort = sp.get("sort");
  const dir = sp.get("dir");

  const setParams = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const defs = useMemo<ColumnDef<Row>[]>(
    () => columns.map((c) => ({ id: c.key, accessorFn: (r) => r[c.key], header: c.header, cell: ({ row }) => renderCell(c, row.original), meta: c })),
    [columns],
  );
  const table = useReactTable({ data: rows, columns: defs, getCoreRowModel: getCoreRowModel(), manualSorting: true, manualPagination: true, pageCount: Math.ceil(total / pageSize) });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const c = h.column.columnDef.meta as Col;
                  const active = c.sortKey && sort === c.sortKey;
                  const numeric = c.align === "end" || ["money", "kg", "number", "pct"].includes(c.type ?? "");
                  return (
                    <th key={h.id} className={cn("h-10 whitespace-nowrap px-4 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", numeric && "text-end", c.hideOnMobile && "hidden md:table-cell")}>
                      {c.sortKey ? (
                        <button
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
                          onClick={() => setParams({ sort: c.sortKey!, dir: active && dir === "asc" ? "desc" : "asc", page: null })}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {active ? (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.id}
                className={cn("border-b last:border-0 transition-colors hover:bg-muted/40", r.original._href && "cursor-pointer")}
                onClick={(e) => { if (r.original._href && !(e.target as HTMLElement).closest("a,button")) router.push(r.original._href); }}
              >
                {r.getVisibleCells().map((cell, i) => {
                  const c = cell.column.columnDef.meta as Col;
                  const numeric = c.align === "end" || ["money", "kg", "number", "pct"].includes(c.type ?? "");
                  return (
                    <td key={cell.id} className={cn("px-4 py-2.5 align-middle", numeric && "text-end", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                      {i === 0 && r.original._href ? (
                        <Link href={r.original._href} className="font-medium text-foreground hover:text-primary">{flexRender(cell.column.columnDef.cell, cell.getContext())}</Link>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <div className="rounded-full bg-muted p-3"><Inbox className="h-5 w-5 text-muted-foreground" /></div>
          <div className="text-sm font-medium">{sp.get("q") ? "No matching records" : emptyTitle}</div>
          {emptyHint && <div className="max-w-sm text-xs text-muted-foreground">{emptyHint}</div>}
          {emptyAction}
        </div>
      )}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span className="tabular">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => setParams({ pageSize: e.target.value, page: null })}
              className="h-8 rounded-md border bg-card px-2"
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft className="rtl:rotate-180" /></Button>
            <span className="px-2 tabular">{page} / {pages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })} aria-label="Next page"><ChevronRight className="rtl:rotate-180" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
