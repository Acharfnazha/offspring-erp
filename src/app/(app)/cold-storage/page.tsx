import Link from "next/link";
import { Plus, Thermometer, Droplets, Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { D, formatKg } from "@/lib/money";
import { businessDate, formatDateTime } from "@/lib/dates";
import { roomUtilization } from "@/lib/services/analytics";
import { getSetting } from "@/lib/options";
import { cn } from "@/lib/utils";
import { BillingCalculator } from "./billing-calculator";

export const metadata = { title: "Cold storage" };

export default async function ColdStoragePage() {
  const user = await requireUser("storage:read");
  const [util, rooms, contracts, policy] = await Promise.all([
    roomUtilization(),
    prisma.coldRoom.findMany({ include: { warehouse: true }, orderBy: { code: "asc" } }),
    prisma.storageContract.findMany({ include: { customer: true, coldRoom: true, movements: true }, orderBy: [{ status: "asc" }, { entryDate: "desc" }] }),
    getSetting<{ ratePerKgMonth: string }>("storageBilling", { ratePerKgMonth: "0.05" }),
  ]);
  const u = new Map(util.map((x) => [x.id, x]));
  const write = can(user, "storage:write");
  return (
    <div className="space-y-5">
      <PageHeader title="Cold storage" description="Refrigerated rooms, manual temperature/humidity log and third-party storage contracts" actions={<>
        <Button variant="outline" asChild><a href="/api/export/storage-contracts?format=xlsx"><Download />Export contracts</a></Button>
        {write && <Button variant="outline" asChild><Link href="/cold-storage/rooms/new"><Plus />Cold room</Link></Button>}
        {write && <Button asChild><Link href="/cold-storage/contracts/new"><Plus />Storage contract</Link></Button>}
      </>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((r) => {
          const x = u.get(r.id)!;
          const dev = r.currentTempC !== null ? D(r.currentTempC).minus(D(r.targetTempC)).abs() : null;
          const alarm = dev !== null && dev.gt(D(r.tempToleranceC));
          return (
            <Link key={r.id} href={`/cold-storage/rooms/${r.id}`}>
              <Card className={cn("p-4 transition-shadow hover:shadow-md", alarm && "border-red-500/50")}>
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-xs font-mono text-muted-foreground">{r.code} · {r.warehouse.name}</div><div className="font-semibold">{r.name}</div></div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className={cn("flex items-center gap-1 tabular", alarm && "font-semibold text-red-600")}><Thermometer className="h-4 w-4" />{r.currentTempC !== null ? `${D(r.currentTempC).toFixed(1)}°C` : "—"} <span className="text-xs text-muted-foreground">/ {D(r.targetTempC).toFixed(1)}</span></span>
                  <span className="flex items-center gap-1 tabular"><Droplets className="h-4 w-4 text-sky-500" />{r.currentHumidity !== null ? `${D(r.currentHumidity).toFixed(0)}%` : "—"} <span className="text-xs text-muted-foreground">/ {D(r.targetHumidity).toFixed(0)}</span></span>
                </div>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted"><div className="bg-emerald-600" style={{ width: `${Math.min(100, x.pct.toNumber())}%` }} /></div>
                <div className="mt-1.5 flex justify-between text-xs text-muted-foreground"><span className="tabular">{formatKg(x.occupiedKg)} used · {formatKg(x.availableKg)} free</span><span className="tabular">{x.pct.toFixed(0)}%</span></div>
                <div className="mt-1 text-[11px] text-muted-foreground">Last reading: {formatDateTime(r.lastReadingAt)} (manual)</div>
              </Card>
            </Link>
          );
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Storage contracts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <DataTable total={contracts.length} page={1} pageSize={Math.max(contracts.length, 1)} emptyTitle="No storage contracts"
                columns={[{ key: "no", header: "Contract", type: "mono" }, { key: "customer", header: "Customer" }, { key: "product", header: "Product", hideOnMobile: true }, { key: "room", header: "Room" }, { key: "entry", header: "Entry", type: "date" }, { key: "kg", header: "In storage", type: "kg" }, { key: "status", header: "Status", type: "badge" }]}
                rows={contracts.map((c) => ({ _href: `/cold-storage/contracts/${c.id}`, no: c.contractNo, customer: c.customer.companyName, product: c.productDescription, room: c.coldRoom.code, entry: c.entryDate.toISOString(), kg: c.movements.reduce((a, m) => (m.type === "IN" ? a.plus(m.quantityKg) : a.minus(m.quantityKg)), D(0)).toString(), status: c.status }))}
              />
            </CardContent>
          </Card>
        </div>
        <BillingCalculator defaultRate={policy.ratePerKgMonth} today={businessDate()} />
      </div>
    </div>
  );
}
