import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Button } from "@/components/ui/button";
import { listParams, orderBy, str, type SP } from "@/lib/list-params";
import { opts } from "@/lib/schemas";
import { D, sum } from "@/lib/money";

export const metadata = { title: "Sales & Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("sales:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["orderNo", "orderDate", "total", "expectedShipmentDate", "customer.companyName"], "orderDate");
  const where: Prisma.SalesOrderWhereInput = {
    ...(lp.q ? { OR: [{ orderNo: { contains: lp.q, mode: "insensitive" } }, { customer: { companyName: { contains: lp.q, mode: "insensitive" } } }] } : {}),
    ...(str(sp, "status") ? { status: str(sp, "status") as never } : {}),
    ...(str(sp, "incoterm") ? { incoterm: str(sp, "incoterm") as never } : {}),
  };
  const [rows, total] = await Promise.all([prisma.salesOrder.findMany({ where, include: { customer: true, items: true }, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take }), prisma.salesOrder.count({ where })]);
  return (
    <div>
      <PageHeader title="Sales & orders" description="Draft → confirmed (reserved) → dispatched → invoiced" actions={can(user, "sales:write") && <Button asChild><Link href="/orders/new"><Plus />New order</Link></Button>} />
      <FilterBar placeholder="Order number, customer…" exportEntity="orders" filters={[{ key: "status", label: "Status", options: opts(["DRAFT", "CONFIRMED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"]) }, { key: "incoterm", label: "Incoterm", options: ["FOB", "CFR", "CIF", "EXW", "DAP"].map((v) => ({ value: v, label: v })) }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} emptyTitle="No orders yet"
        columns={[{ key: "no", header: "Order", sortKey: "orderNo", type: "mono" }, { key: "customer", header: "Customer", sortKey: "customer.companyName" }, { key: "date", header: "Date", type: "date", sortKey: "orderDate", hideOnMobile: true }, { key: "ship", header: "Ship by", type: "date", sortKey: "expectedShipmentDate", hideOnMobile: true }, { key: "incoterm", header: "Terms", hideOnMobile: true }, { key: "kg", header: "Quantity", type: "kg" }, { key: "fulfil", header: "Dispatched", type: "pct", hideOnMobile: true }, { key: "total", header: "Total", type: "money", sortKey: "total" }, { key: "status", header: "Status", type: "badge" }]}
        rows={rows.map((o) => { const kg = sum(o.items.map((i) => i.quantityKg)); return { _href: `/orders/${o.id}`, no: o.orderNo, customer: o.customer.companyName, date: o.orderDate.toISOString(), ship: o.expectedShipmentDate?.toISOString(), incoterm: o.incoterm, kg: kg.toString(), fulfil: kg.gt(0) ? sum(o.items.map((i) => i.fulfilledKg)).div(kg).mul(100).toFixed(1) : "0", total: D(o.total).toString(), _currency: o.currency, status: o.status }; })} />
    </div>
  );
}
