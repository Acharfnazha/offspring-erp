import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { D, formatKg, formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, isoDate } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { roomOptions, supplierOptions } from "@/lib/options";
import { BatchActions } from "./batch-actions";
import { releaseAction } from "../actions";
import { DocumentList } from "@/components/data/document-list";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("inventory:read");
  const { id } = await params;
  const b = await prisma.inventoryBatch.findUnique({
    where: { id },
    include: {
      variety: { include: { product: true } }, coldRoom: true, supplier: true, goodsReceipt: true, parentBatch: true, childBatches: true,
      movements: { orderBy: { createdAt: "desc" }, include: { user: true } },
      reservations: { orderBy: { createdAt: "desc" }, include: { orderItem: { include: { order: { include: { customer: true } } } } } },
    },
  });
  if (!b) notFound();
  const write = can(user, "inventory:write");
  const fin = can(user, "analytics:finance");
  const available = D(b.onHandKg).minus(D(b.reservedKg));
  const [rooms, suppliers] = write ? await Promise.all([roomOptions(), supplierOptions()]) : [[], []];

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${b.batchNo} · ${b.variety.name}`}
        crumbs={[{ label: "Inventory", href: "/inventory" }, { label: b.batchNo }]}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={b.status} /> {b.variety.product.name} · {b.grade === "CUSTOM" ? b.customGrade : label(b.grade)} · {b.origin}</span>}
        actions={write && b.onHandKg.gt(0) ? (
          <BatchActions
            rooms={rooms}
            suppliers={suppliers}
            batch={{
              id: b.id, batchNo: b.batchNo, available: available.toFixed(3), onHand: D(b.onHandKg).toFixed(3), coldRoomId: b.coldRoomId,
              edit: { grade: b.grade, customGrade: b.customGrade ?? "", origin: b.origin, supplierId: b.supplierId ?? "", harvestDate: isoDate(b.harvestDate), expiryDate: isoDate(b.expiryDate), packagingType: b.packagingType ?? "", notes: b.notes ?? "", cartons: b.cartons, status: b.status === "QUARANTINE" ? "QUARANTINE" : "AVAILABLE" },
            }}
          />
        ) : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Received", formatKg(b.receivedKg)], ["On hand", formatKg(b.onHandKg)], ["Reserved", formatKg(b.reservedKg)], ["Available", formatKg(available)]].map(([l, v]) => (
          <Card key={l} className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div><div className="mt-1 text-xl font-semibold tabular">{v}</div></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Batch details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Storage location">{b.coldRoom ? <Link className="text-primary hover:underline" href={`/cold-storage/rooms/${b.coldRoom.id}`}>{b.coldRoom.code} · {b.coldRoom.name}</Link> : "Unassigned"}</Field>
              <Field label="Supplier">{b.supplier ? <Link className="text-primary hover:underline" href={`/suppliers/${b.supplier.id}`}>{b.supplier.name}</Link> : "—"}</Field>
              <Field label="Goods receipt">{b.goodsReceipt?.receiptNo ?? "Manual receipt"}</Field>
              <Field label="Harvest date">{formatDate(b.harvestDate)}</Field>
              <Field label="Arrival date">{formatDate(b.arrivalDate)}</Field>
              <Field label="Best before">{formatDate(b.expiryDate)}</Field>
              <Field label="Cartons">{b.cartons}</Field>
              <Field label="Packaging">{b.packagingType}</Field>
              {fin && <Field label="Cost per kg">{formatMoney(b.costPerKg)}</Field>}
              {fin && <Field label="Total acquisition cost">{formatMoney(D(b.receivedKg).mul(D(b.costPerKg)))}</Field>}
              {fin && <Field label="Current stock value">{formatMoney(D(b.onHandKg).mul(D(b.costPerKg)))}</Field>}
              <Field label="Split from">{b.parentBatch ? <Link className="text-primary hover:underline" href={`/inventory/${b.parentBatch.id}`}>{b.parentBatch.batchNo}</Link> : "—"}</Field>
            </dl>
            {b.childBatches.length > 0 && (
              <div className="mt-4 text-sm"><span className="text-muted-foreground">Split batches: </span>{b.childBatches.map((c) => <Link key={c.id} href={`/inventory/${c.id}`} className="me-2 font-mono text-xs text-primary hover:underline">{c.batchNo}</Link>)}</div>
            )}
            {b.notes && <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{b.notes}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reservations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {b.reservations.length === 0 && <p className="text-xs text-muted-foreground">No reservations.</p>}
            {b.reservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium tabular">{formatKg(r.quantityKg)} <span className="text-xs text-muted-foreground">({formatKg(r.fulfilledKg)} fulfilled)</span></div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.orderItem ? <Link className="text-primary hover:underline" href={`/orders/${r.orderItem.order.id}`}>{r.orderItem.order.orderNo} · {r.orderItem.order.customer.companyName}</Link> : r.note}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={r.status} />
                  {write && r.status === "ACTIVE" && (
                    <ActionButton action={releaseAction.bind(null, r.id, b.id)} confirmTitle="Release reservation?" confirmText="The remaining reserved quantity becomes available again.">Release</ActionButton>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Movement history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2 text-start">Date</th><th className="px-4 py-2 text-start">Type</th><th className="px-4 py-2 text-end">Quantity</th><th className="px-4 py-2 text-end">On hand after</th><th className="px-4 py-2 text-end">Reserved after</th><th className="px-4 py-2 text-start">Reference</th><th className="px-4 py-2 text-start">By</th></tr>
            </thead>
            <tbody>
              {b.movements.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 tabular text-xs">{formatDateTime(m.createdAt)}</td>
                  <td className="px-4 py-2"><Badge variant={m.type === "SPOILAGE" ? "danger" : m.type === "DISPATCH" ? "info" : m.type === "RECEIPT" || m.type === "TRANSFER_IN" ? "success" : "muted"}>{label(m.type)}</Badge></td>
                  <td className="px-4 py-2 text-end tabular">{formatKg(m.quantityKg)}</td>
                  <td className="px-4 py-2 text-end tabular">{formatKg(m.onHandAfterKg)}</td>
                  <td className="px-4 py-2 text-end tabular">{formatKg(m.reservedAfterKg)}</td>
                  <td className="px-4 py-2 text-xs">{m.reference}{m.notes ? ` — ${m.notes}` : ""}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{m.user?.name ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <DocumentList owner={{ batchId: b.id }} />
    </div>
  );
}
