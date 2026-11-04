import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Kpi, pctChange } from "@/components/data/kpi";
import { RangeFilter } from "@/components/data/range-filter";
import { TrendChart, DonutChart, HBarChart } from "@/components/charts/charts";
import { formatKg, formatMoney } from "@/lib/money";
import { formatDate, resolveRange } from "@/lib/dates";
import { str, type SP } from "@/lib/list-params";
import { label } from "@/lib/schemas";
import * as A from "@/lib/services/analytics";

export const metadata = { title: "Analytics" };

function T({ head, rows, numericFrom = 1 }: { head: string[]; rows: (string | number | React.ReactNode)[][]; numericFrom?: number }) {
  if (!rows.length) return <p className="py-8 text-center text-xs text-muted-foreground">No data for this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{head.map((h, i) => <th key={h} className={`px-2 py-2 ${i >= numericFrom ? "text-end" : "text-start"}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className={`px-2 py-2 ${j >= numericFrom ? "text-end tabular" : ""}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ExportBtn({ entity, qs }: { entity: string; qs: string }) {
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" asChild><a href={`/api/export/${entity}?format=csv&${qs}`}><Download />CSV</a></Button>
      <Button size="sm" variant="ghost" asChild><a href={`/api/export/${entity}?format=xlsx&${qs}`}>XLSX</a></Button>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("analytics:read");
  const sp = await searchParams;
  const r = resolveRange(str(sp, "range") ?? "year", str(sp, "from"), str(sp, "to"));
  const qs = new URLSearchParams(Object.entries({ range: r.key, from: str(sp, "from") ?? "", to: str(sp, "to") ?? "" }).filter(([, v]) => v)).toString();
  const fin = can(user, "analytics:finance");
  const [pl, prev, series, byProduct, byCustomer, byCountry, aging, turnover, rooms, ships, storageRev, expCat, byVariety] = await Promise.all([
    fin ? A.profitAndLoss(r.from, r.toExclusive) : null,
    fin ? A.profitAndLoss(r.prevFrom, r.prevToExclusive) : null,
    fin ? A.monthlySeries(12) : [],
    fin ? A.salesByProduct(r.from, r.toExclusive) : [],
    fin ? A.profitByCustomer(r.from, r.toExclusive) : [],
    fin ? A.profitByCountry(r.from, r.toExclusive) : [],
    fin ? A.receivablesAging() : null,
    A.inventoryTurnover(r.from, r.toExclusive),
    A.roomUtilization(),
    A.shipmentPerformance(r.from, r.toExclusive),
    fin ? A.storageRevenue(r.from, r.toExclusive) : null,
    fin ? A.expensesByCategory(r.from, r.toExclusive) : [],
    A.inventoryByVariety(),
  ]);
  const volume = byProduct.reduce((a, p) => a + p.kg, 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Business analytics" description={<>Transactional reports · {formatDate(r.from)} – {formatDate(r.to)} · compared with {formatDate(r.prevFrom)} – {formatDate(r.prevTo)}</>} actions={<RangeFilter current={r.key} />} />
      {fin && pl && prev && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Revenue" value={formatMoney(pl.revenue)} delta={pctChange(pl.revenue.toNumber(), prev.revenue.toNumber())} />
            <Kpi label="Cost of goods sold" value={formatMoney(pl.cogs)} delta={pctChange(pl.cogs.toNumber(), prev.cogs.toNumber())} invert />
            <Kpi label="Gross profit" value={formatMoney(pl.grossProfit)} delta={pctChange(pl.grossProfit.toNumber(), prev.grossProfit.toNumber())} sub={`${pl.grossMarginPct.toFixed(1)}% margin`} />
            <Kpi label="Logistics" value={formatMoney(pl.logistics)} delta={pctChange(pl.logistics.toNumber(), prev.logistics.toNumber())} invert />
            <Kpi label="Operating expenses" value={formatMoney(pl.opex)} delta={pctChange(pl.opex.toNumber(), prev.opex.toNumber())} invert />
            <Kpi label="Net profit" value={formatMoney(pl.netProfit)} delta={pctChange(pl.netProfit.toNumber(), prev.netProfit.toNumber())} />
          </div>
          <p className="text-[11px] text-muted-foreground">Revenue = issued sales + storage invoices (USD) − credit notes. COGS = batch cost of dispatched kg. Net profit = gross profit − shipment logistics − approved operating expenses (fruit-purchase expenses excluded to avoid double counting with COGS). Operational view — not statutory financial statements.</p>
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Revenue, expenses & profit — last 12 months</CardTitle></div><ExportBtn entity="report-monthly" qs={qs} /></CardHeader>
            <CardContent><TrendChart data={series} series={[{ key: "revenue", name: "Revenue" }, { key: "cogs", name: "COGS", type: "line" }, { key: "expenses", name: "Total expenses", type: "line" }, { key: "profit", name: "Profit", type: "bar" }]} height={300} /></CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Profit by product</CardTitle><CardDescription>Sales volume {formatKg(volume)}</CardDescription></div><ExportBtn entity="report-products" qs={qs} /></CardHeader>
              <CardContent><T head={["Variety", "Volume", "Revenue", "COGS", "Gross profit", "Margin"]} rows={byProduct.map((p) => [p.name, formatKg(p.kg), formatMoney(p.value), formatMoney(p.cogs), formatMoney(p.profit), p.value ? `${((p.profit / p.value) * 100).toFixed(1)}%` : "—"])} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Profit by destination country</CardTitle></div><ExportBtn entity="report-countries" qs={qs} /></CardHeader>
              <CardContent className="space-y-3">{byCountry.length > 0 && <HBarChart data={byCountry} dataKey="profit" height={180} />}<T head={["Country", "Volume", "Revenue", "Gross profit", "Margin"]} rows={byCountry.map((c) => [c.name, formatKg(c.kg), formatMoney(c.revenue), formatMoney(c.profit), `${c.marginPct}%`])} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Profit by customer</CardTitle></div><ExportBtn entity="report-customers" qs={qs} /></CardHeader>
              <CardContent><T head={["Customer", "Volume", "Revenue", "Gross profit", "Margin"]} rows={byCustomer.map((c) => [<Link key={c.id} className="text-primary hover:underline" href={`/customers/${c.id}`}>{c.name}</Link>, formatKg(c.kg), formatMoney(c.revenue), formatMoney(c.profit), `${c.marginPct}%`])} /></CardContent>
            </Card>
            {aging && (
              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Receivables aging</CardTitle><CardDescription>Days past due date, as of today</CardDescription></div><ExportBtn entity="report-aging" qs={qs} /></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">{([["Current", aging.buckets.current], ["1–30", aging.buckets.d1_30], ["31–60", aging.buckets.d31_60], ["61–90", aging.buckets.d61_90], ["90+", aging.buckets.d90p]] as const).map(([l, v]) => <div key={l} className="rounded-md bg-muted/60 p-2"><div className="text-muted-foreground">{l}</div><div className="font-semibold tabular">{formatMoney(v)}</div></div>)}</div>
                  <T head={["Customer", "Current", "1–30", "31–60", "61–90", "90+", "Total"]} rows={aging.rows.map((a) => [a.name, formatMoney(a.current), formatMoney(a.d1_30), formatMoney(a.d31_60), formatMoney(a.d61_90), formatMoney(a.d90p), formatMoney(a.total)])} />
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Inventory turnover</CardTitle><CardDescription>COGS ÷ current stock value ({turnover.days} days)</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-3xl font-semibold tabular">{turnover.turnover.toFixed(2)}×</div>
            {fin && <div className="flex justify-between"><span className="text-muted-foreground">COGS in period</span><span className="tabular">{formatMoney(turnover.cogs)}</span></div>}
            {fin && <div className="flex justify-between"><span className="text-muted-foreground">Current stock value</span><span className="tabular">{formatMoney(turnover.inventoryValue)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Approx. days on hand</span><span className="tabular">{turnover.daysOnHand ? turnover.daysOnHand.toFixed(0) : "—"}</span></div>
            <Button size="sm" variant="ghost" asChild><a href={`/api/export/movements?format=xlsx&${qs}`}><Download />Movement ledger (XLSX)</a></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Warehouse occupancy</CardTitle>{storageRev && <CardDescription>Cold-storage revenue in period: {formatMoney(storageRev)}</CardDescription>}</CardHeader>
          <CardContent><HBarChart data={rooms.map((x) => ({ name: x.code, value: Number(x.pct.toFixed(1)) }))} format="pct" height={200} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Shipment performance</CardTitle><CardDescription>Shipments created in period</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-md bg-muted/60 p-2"><div className="text-xs text-muted-foreground">Shipments</div><div className="text-lg font-semibold">{ships.total}</div></div><div className="rounded-md bg-muted/60 p-2"><div className="text-xs text-muted-foreground">On time</div><div className="text-lg font-semibold">{ships.onTimePct === null ? "—" : `${ships.onTimePct.toFixed(0)}%`}</div></div><div className="rounded-md bg-muted/60 p-2"><div className="text-xs text-muted-foreground">Avg transit</div><div className="text-lg font-semibold">{ships.avgTransitDays === null ? "—" : `${ships.avgTransitDays.toFixed(0)} d`}</div></div></div>
            {fin && <div className="flex justify-between"><span className="text-muted-foreground">Logistics cost</span><span className="tabular">{formatMoney(ships.logisticsCost)}</span></div>}
            <div className="flex flex-wrap gap-1.5 pt-1">{ships.byStatus.map((s) => <span key={s.name} className="rounded bg-muted px-2 py-0.5 text-xs">{label(s.name)}: {s.value}</span>)}</div>
            <Button size="sm" variant="ghost" asChild><a href={`/api/export/shipments?format=xlsx`}><Download />Shipments (XLSX)</a></Button>
          </CardContent>
        </Card>
        {fin && (
          <Card>
            <CardHeader><CardTitle>Expenses by category</CardTitle></CardHeader>
            <CardContent>{expCat.length ? <DonutChart data={expCat.map((e) => ({ name: label(e.name), value: e.value }))} height={200} /> : <p className="text-xs text-muted-foreground">No expenses in period.</p>}</CardContent>
          </Card>
        )}
        <Card className={fin ? "xl:col-span-2" : "xl:col-span-3"}>
          <CardHeader><CardTitle>Stock by variety</CardTitle><CardDescription>Available vs reserved</CardDescription></CardHeader>
          <CardContent><TrendChart data={byVariety} x="name" format="kg" stacked series={[{ key: "available", name: "Available", type: "bar" }, { key: "reserved", name: "Reserved", type: "bar" }]} height={240} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
