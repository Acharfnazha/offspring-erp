import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, FileText, HandCoins, Landmark, Scale, Ship, Snowflake, TrendingUp, Thermometer, Clock } from "lucide-react";
import { requireUser, can } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Kpi, pctChange } from "@/components/data/kpi";
import { RangeFilter } from "@/components/data/range-filter";
import { TrendChart, DonutChart, HBarChart } from "@/components/charts/charts";
import { D, formatKg, formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, isoDate, resolveRange, todayDate } from "@/lib/dates";
import { str, type SP } from "@/lib/list-params";
import * as A from "@/lib/services/analytics";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { dict } = await getDictionary();
  const range = resolveRange(str(sp, "range") ?? "year", str(sp, "from"), str(sp, "to"));
  const fin = can(user, "analytics:finance");

  const [pl, plPrev, ar, ap, inv, rooms, activeShipments, pendingQuotes, awaitingPayment, series, byCountry, byProduct, byVariety, activity, overdue, expiring] = await Promise.all([
    fin ? A.profitAndLoss(range.from, range.toExclusive) : null,
    fin ? A.profitAndLoss(range.prevFrom, range.prevToExclusive) : null,
    fin ? A.receivables() : null,
    fin ? A.payables() : null,
    A.inventoryTotals(),
    A.roomUtilization(),
    prisma.shipment.count({ where: { status: { in: ["PLANNING", "PACKING", "READY_FOR_DISPATCH", "IN_TRANSIT", "ARRIVED"] } } }),
    prisma.quotation.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
    prisma.salesOrder.count({ where: { status: { not: "CANCELLED" }, invoices: { some: { type: "SALES", status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } } } }),
    fin ? A.monthlySeries(12) : [],
    fin ? A.salesByCountry(range.from, range.toExclusive) : [],
    fin ? A.salesByProduct(range.from, range.toExclusive) : [],
    A.inventoryByVariety(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: true }, where: { action: { notIn: ["auth.login", "auth.logout", "auth.login_failed"] } } }),
    fin ? prisma.invoice.findMany({ where: { status: "OVERDUE" }, include: { customer: true, supplier: true }, orderBy: { dueDate: "asc" }, take: 5 }) : [],
    A.expiringSoon(7),
  ]);

  const cap = rooms.filter((r) => r.status !== "OFFLINE").reduce((a, r) => a.plus(r.capacityKg), D(0));
  const occ = rooms.reduce((a, r) => a.plus(r.occupiedKg), D(0));
  const occPct = cap.gt(0) ? occ.div(cap).mul(100).toNumber() : 0;
  const tempAlerts = await prisma.coldRoom.findMany({ where: { status: "OPERATIONAL", currentTempC: { not: null } } });
  const tempExceptions = tempAlerts.filter((r) => D(r.currentTempC).minus(D(r.targetTempC)).abs().gt(D(r.tempToleranceC)));
  const rangeLabel = `${formatDate(range.from)} – ${formatDate(range.to)}`;
  const today = todayDate();

  return (
    <div className="space-y-5">
      <PageHeader title={dict.dashboard.title} description={<>{dict.dashboard.subtitle} · <span className="tabular">{rangeLabel}</span></>} actions={<RangeFilter current={range.key} />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {fin && pl && plPrev && ar && ap && (
          <>
            <Kpi label="Total revenue" value={formatMoney(pl.revenue)} delta={pctChange(pl.revenue.toNumber(), plPrev.revenue.toNumber())} sub="vs previous period" icon={<CircleDollarSign />} href="/analytics" />
            <Kpi label="Net profit" value={formatMoney(pl.netProfit)} delta={pctChange(pl.netProfit.toNumber(), plPrev.netProfit.toNumber())} sub={`Gross margin ${pl.grossMarginPct.toFixed(1)}%`} icon={<TrendingUp />} href="/analytics" />
            <Kpi label="Receivables" value={formatMoney(ar.amount)} sub={`${ar.count} open invoices`} icon={<HandCoins />} href="/invoices?status=open" />
            <Kpi label="Payables" value={formatMoney(ap.amount)} sub={`${ap.count} supplier invoices`} icon={<Landmark />} href="/invoices?type=PURCHASE&status=open" />
          </>
        )}
        <Kpi label="Inventory weight" value={formatKg(inv.kg)} sub={`${formatKg(inv.reserved)} reserved`} icon={<Scale />} href="/inventory" />
        {fin && <Kpi label="Inventory value" value={formatMoney(inv.value)} sub="at acquisition cost" icon={<Boxes />} href="/inventory" />}
        <Kpi label="Cold-room occupancy" value={`${occPct.toFixed(1)}%`} sub={`${formatKg(occ)} of ${formatKg(cap)}`} icon={<Snowflake />} href="/cold-storage" />
        <Kpi label="Active shipments" value={String(activeShipments)} sub="planning → arrived" icon={<Ship />} href="/shipments" />
        <Kpi label="Pending quotations" value={String(pendingQuotes)} sub="draft or sent" icon={<FileText />} href="/quotations" />
        <Kpi label="Orders awaiting payment" value={String(awaitingPayment)} sub="with open invoices" icon={<Clock />} href="/orders" />
      </div>

      {(overdue.length > 0 || expiring.length > 0 || tempExceptions.length > 0) && (
        <Card className="border-amber-500/30 bg-amber-500/[0.04]">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Alerts</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Overdue payments</div>
              {overdue.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : overdue.map((i) => (
                <Link key={i.id} href={`/invoices/${i.id}`} className="flex justify-between gap-2 py-1 text-sm hover:text-primary">
                  <span className="truncate">{i.invoiceNo} · {i.customer?.companyName ?? i.supplier?.name}</span>
                  <span className="shrink-0 tabular text-red-600">{formatMoney(D(i.total).minus(D(i.amountPaid)), i.currency)}</span>
                </Link>
              ))}
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Expiring stock (7 days)</div>
              {expiring.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : expiring.map((b) => (
                <Link key={b.id} href={`/inventory/${b.id}`} className="flex justify-between gap-2 py-1 text-sm hover:text-primary">
                  <span className="truncate">{b.batchNo} · {b.variety.name}</span>
                  <span className={`shrink-0 tabular ${b.expiryDate! < today ? "text-red-600" : "text-amber-600"}`}>{isoDate(b.expiryDate)}</span>
                </Link>
              ))}
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Temperature exceptions</div>
              {tempExceptions.length === 0 ? <p className="text-xs text-muted-foreground">All rooms within tolerance</p> : tempExceptions.map((r) => (
                <Link key={r.id} href={`/cold-storage/rooms/${r.id}`} className="flex justify-between gap-2 py-1 text-sm hover:text-primary">
                  <span className="flex items-center gap-1.5 truncate"><Thermometer className="h-3.5 w-3.5 text-red-500" />{r.name}</span>
                  <span className="shrink-0 tabular text-red-600">{D(r.currentTempC).toFixed(1)}°C / {D(r.targetTempC).toFixed(1)}°C</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {fin && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader><CardTitle>Revenue, expenses & profit</CardTitle><CardDescription>Last 12 months · expenses = COGS + logistics + operating expenses</CardDescription></CardHeader>
            <CardContent><TrendChart data={series} series={[{ key: "revenue", name: "Revenue" }, { key: "expenses", name: "Expenses", type: "line" }, { key: "profit", name: "Profit", type: "bar" }]} height={280} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sales by country</CardTitle><CardDescription>{rangeLabel}</CardDescription></CardHeader>
            <CardContent>{byCountry.length ? <DonutChart data={byCountry} /> : <Empty />}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sales by product</CardTitle><CardDescription>Dispatched value · {rangeLabel}</CardDescription></CardHeader>
            <CardContent>{byProduct.length ? <HBarChart data={byProduct} /> : <Empty />}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payment collection</CardTitle><CardDescription>Collected vs invoiced, last 12 months</CardDescription></CardHeader>
            <CardContent><TrendChart data={series} series={[{ key: "revenue", name: "Invoiced", type: "bar" }, { key: "collected", name: "Collected", type: "line" }]} height={260} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Inventory by variety</CardTitle><CardDescription>On hand (kg)</CardDescription></CardHeader>
            <CardContent>{byVariety.length ? <HBarChart data={byVariety} dataKey="kg" format="kg" /> : <Empty />}</CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {!fin && (
          <Card>
            <CardHeader><CardTitle>Inventory by variety</CardTitle><CardDescription>On hand (kg)</CardDescription></CardHeader>
            <CardContent>{byVariety.length ? <HBarChart data={byVariety} dataKey="kg" format="kg" /> : <Empty />}</CardContent>
          </Card>
        )}
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Cold-room utilization</CardTitle><CardDescription>Own inventory + customer goods under storage contracts</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {rooms.map((r) => (
              <Link key={r.id} href={`/cold-storage/rooms/${r.id}`} className="block">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{r.code} · {r.name} {r.status !== "OPERATIONAL" && <Badge variant="warning" className="ms-1">{r.status.toLowerCase()}</Badge>}</span>
                  <span className="tabular text-muted-foreground">{formatKg(r.occupiedKg)} / {formatKg(r.capacityKg)} · {r.pct.toFixed(0)}%</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="bg-emerald-600" style={{ width: `${Math.min(100, r.capacityKg.gt(0) ? r.ownKg.div(r.capacityKg).mul(100).toNumber() : 0)}%` }} />
                  <div className="bg-sky-500" style={{ width: `${Math.min(100, r.capacityKg.gt(0) ? r.customerKg.div(r.capacityKg).mul(100).toNumber() : 0)}%` }} />
                </div>
              </Link>
            ))}
            <div className="flex gap-4 pt-1 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-600" />Own stock</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-500" />Customer goods</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Audit trail</CardDescription></CardHeader>
          <CardContent>
            <ol className="relative space-y-3 border-s ps-4">
              {activity.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                  <div className="leading-snug">{a.summary ?? a.action}</div>
                  <div className="text-[11px] text-muted-foreground">{a.user?.name ?? "System"} · {formatDateTime(a.createdAt)}</div>
                </li>
              ))}
              {activity.length === 0 && <li className="text-xs text-muted-foreground">No activity yet.</li>}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No data for this period</div>;
}
