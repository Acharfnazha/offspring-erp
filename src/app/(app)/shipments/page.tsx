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
import { SHIPMENT_STATUSES, opts } from "@/lib/schemas";

export const metadata = { title: "Shipments" };

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("shipments:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["shipmentNo", "etd", "eta", "createdAt", "customer.companyName"], "createdAt");
  const where: Prisma.ShipmentWhereInput = {
    ...(lp.q ? { OR: [{ shipmentNo: { contains: lp.q, mode: "insensitive" } }, { containerNo: { contains: lp.q, mode: "insensitive" } }, { customer: { companyName: { contains: lp.q, mode: "insensitive" } } }, { destination: { contains: lp.q, mode: "insensitive" } }, { portOfDischarge: { contains: lp.q, mode: "insensitive" } }] } : {}),
    ...(str(sp, "status") ? { status: str(sp, "status") as never } : {}),
  };
  const [rows, total] = await Promise.all([prisma.shipment.findMany({ where, include: { customer: true }, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take }), prisma.shipment.count({ where })]);
  return (
    <div>
      <PageHeader title="Container shipments" description="Reefer containers, air freight and trucking" actions={can(user, "shipments:write") && <Button asChild><Link href="/shipments/new"><Plus />New shipment</Link></Button>} />
      <FilterBar placeholder="Shipment, container, customer, port…" exportEntity="shipments" filters={[{ key: "status", label: "Status", options: opts(SHIPMENT_STATUSES) }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} emptyTitle="No shipments yet"
        columns={[{ key: "no", header: "Shipment", sortKey: "shipmentNo", type: "mono" }, { key: "customer", header: "Customer", sortKey: "customer.companyName" }, { key: "container", header: "Container", type: "mono", hideOnMobile: true }, { key: "route", header: "Route", hideOnMobile: true }, { key: "etd", header: "ETD", type: "date", sortKey: "etd" }, { key: "eta", header: "ETA", type: "date", sortKey: "eta" }, { key: "kg", header: "Net weight", type: "kg", hideOnMobile: true }, { key: "status", header: "Status", type: "badge" }]}
        rows={rows.map((s) => ({ _href: `/shipments/${s.id}`, no: s.shipmentNo, customer: s.customer.companyName, container: s.containerNo, route: `${s.portOfLoading ?? s.origin} → ${s.portOfDischarge ?? s.destination}`, etd: s.etd?.toISOString(), eta: s.eta?.toISOString(), kg: s.netWeightKg?.toString(), status: s.status }))} />
    </div>
  );
}
