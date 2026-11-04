import Link from "next/link";
import { Plus, Layers } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Col } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/data/kpi";
import { listParams, orderBy, str, type SP } from "@/lib/list-params";
import { D, formatKg, formatMoney } from "@/lib/money";
import { GRADES, opts, label } from "@/lib/schemas";
import { roomOptions, varietyOptions } from "@/lib/options";
import { batchWhere } from "@/lib/queries/inventory";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("inventory:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["batchNo", "arrivalDate", "expiryDate", "onHandKg", "costPerKg", "variety.name"], "arrivalDate");
  const where = batchWhere(sp);
  const [rows, total, agg, varieties, rooms] = await Promise.all([
    prisma.inventoryBatch.findMany({ where, include: { variety: { include: { product: true } }, coldRoom: true, supplier: true }, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take }),
    prisma.inventoryBatch.count({ where }),
    prisma.inventoryBatch.aggregate({ where, _sum: { onHandKg: true, reservedKg: true, cartons: true } }),
    varietyOptions(),
    roomOptions(),
  ]);
  const value = await prisma.$queryRaw<{ v: string | null }[]>`SELECT SUM("onHandKg"*"costPerKg")::text v FROM "InventoryBatch" WHERE "onHandKg" > 0`;
  const fin = can(user, "analytics:finance");
  const cols: Col[] = [
    { key: "batchNo", header: "Batch", sortKey: "batchNo", type: "mono" },
    { key: "variety", header: "Variety", sortKey: "variety.name" },
    { key: "grade", header: "Grade" },
    { key: "room", header: "Location", hideOnMobile: true },
    { key: "arrival", header: "Arrived", type: "date", sortKey: "arrivalDate", hideOnMobile: true },
    { key: "expiry", header: "Best before", type: "date", sortKey: "expiryDate", hideOnMobile: true },
    { key: "onHand", header: "On hand", type: "kg", sortKey: "onHandKg" },
    { key: "available", header: "Available", type: "kg" },
    { key: "cartons", header: "Cartons", type: "number", hideOnMobile: true },
    ...(fin ? [{ key: "cost", header: "Cost/kg", type: "money", sortKey: "costPerKg", hideOnMobile: true } as Col] : []),
    { key: "status", header: "Status", type: "badge" },
  ];
  return (
    <div>
      <PageHeader
        title="Fruit inventory"
        description="Batches across all cold rooms. Every movement is recorded in an immutable ledger."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/inventory/aging"><Layers />FIFO / FEFO</Link></Button>
            {can(user, "inventory:write") && <Button asChild><Link href="/inventory/new"><Plus />Receive inventory</Link></Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="On hand (filtered)" value={formatKg(agg._sum.onHandKg)} sub={`${total} batches`} />
        <Kpi label="Reserved" value={formatKg(agg._sum.reservedKg)} sub="against orders" />
        <Kpi label="Available" value={formatKg(D(agg._sum.onHandKg).minus(D(agg._sum.reservedKg)))} sub={`${agg._sum.cartons ?? 0} cartons`} />
        {fin && <Kpi label="Stock value (all)" value={formatMoney(value[0]?.v)} sub="at acquisition cost" />}
      </div>
      <FilterBar
        placeholder="Batch, variety, origin, supplier…"
        exportEntity="inventory"
        filters={[
          { key: "variety", label: "Variety", options: varieties },
          { key: "grade", label: "Grade", options: opts(GRADES) },
          { key: "room", label: "Room", options: rooms },
          { key: "status", label: "Status", options: [{ value: "all", label: "All incl. depleted" }, ...opts(["AVAILABLE", "RESERVED", "QUARANTINE", "DEPLETED", "SPOILED"])] },
        ]}
      />
      <DataTable
        columns={cols}
        total={total}
        page={lp.page}
        pageSize={lp.pageSize}
        emptyTitle="No inventory batches"
        emptyHint="Receive fruit into a cold room to start tracking stock."
        rows={rows.map((b) => ({
          _href: `/inventory/${b.id}`,
          batchNo: b.batchNo,
          variety: `${b.variety.name}`,
          grade: b.grade === "CUSTOM" ? b.customGrade ?? "Custom" : label(b.grade),
          room: b.coldRoom?.code ?? "Unassigned",
          arrival: b.arrivalDate.toISOString(),
          expiry: b.expiryDate?.toISOString(),
          onHand: b.onHandKg.toString(),
          available: D(b.onHandKg).minus(D(b.reservedKg)).toString(),
          cartons: b.cartons,
          cost: b.costPerKg.toString(),
          status: b.status,
        }))}
      />
    </div>
  );
}
