import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, RefreshCw, Link2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/forms/action-dialog";
import { DocumentList } from "@/components/data/document-list";
import { D, formatKg, formatMoney, sum } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { SHIPMENT_STATUSES, label } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { linkOrderAction, updateShipmentStatusAction } from "../actions";
import { ActionButton } from "@/components/forms/action-button";

const FLOW = ["PLANNING", "PACKING", "READY_FOR_DISPATCH", "IN_TRANSIT", "ARRIVED", "DELIVERED", "COMPLETED"];

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("shipments:read");
  const { id } = await params;
  const s = await prisma.shipment.findUnique({ where: { id }, include: { customer: true, orders: { include: { order: true } }, items: { include: { orderItem: { include: { variety: true, order: true } } } }, events: { orderBy: { occurredAt: "desc" } }, invoices: true, expenses: true } });
  if (!s) notFound();
  const write = can(user, "shipments:write");
  const fin = can(user, "finance:read");
  const logistics = D(s.freightCost).plus(s.insuranceCost).plus(s.documentationCost).plus(s.customsCost);
  const idx = FLOW.indexOf(s.status);
  const linkable = write ? await prisma.salesOrder.findMany({ where: { customerId: s.customerId, status: { in: ["CONFIRMED", "PARTIALLY_FULFILLED", "FULFILLED"] }, shipments: { none: { shipmentId: s.id } } } }) : [];
  return (
    <div className="space-y-4">
      <PageHeader title={`${s.shipmentNo}${s.containerNo ? ` · ${s.containerNo}` : ""}`} crumbs={[{ label: "Shipments", href: "/shipments" }, { label: s.shipmentNo }]} description={<span className="flex items-center gap-2"><StatusBadge status={s.status} />{s.customer.companyName} · {s.portOfLoading ?? s.origin} → {s.portOfDischarge ?? s.destination}</span>}
        actions={write && <>
          {!["COMPLETED", "CANCELLED"].includes(s.status) && <ActionDialog trigger={<Button><RefreshCw />Update status</Button>} title="Update shipment status" description="Adds an entry to the shipment timeline." fields={[{ name: "status", label: "New status", type: "select", options: SHIPMENT_STATUSES.map((x) => ({ value: x, label: label(x) })), defaultValue: FLOW[Math.min(idx + 1, FLOW.length - 1)] }, { name: "location", label: "Location" }, { name: "note", label: "Note", type: "textarea" }]} onSubmit={updateShipmentStatusAction.bind(null, s.id)} />}
          {linkable.length > 0 && <ActionButton action={linkOrderAction.bind(null, s.id, linkable[0].id)} confirmTitle={`Link order ${linkable[0].orderNo}?`}><Link2 />Link {linkable[0].orderNo}</ActionButton>}
          <Button variant="outline" asChild><Link href={`/shipments/${s.id}/edit`}><Pencil />Edit</Link></Button>
        </>} />
      <Card>
        <CardContent className="overflow-x-auto pt-5">
          <ol className="flex min-w-[640px] items-center">
            {FLOW.map((st, i) => (
              <li key={st} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold", s.status === "CANCELLED" ? "border-muted text-muted-foreground" : i <= idx ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/30 text-muted-foreground")}>{i + 1}</div>
                  <span className={cn("whitespace-nowrap text-[11px]", i === idx ? "font-semibold" : "text-muted-foreground")}>{label(st)}</span>
                </div>
                {i < FLOW.length - 1 && <div className={cn("mx-1 mb-5 h-0.5 flex-1", i < idx ? "bg-emerald-600" : "bg-muted")} />}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Shipment details</CardTitle></CardHeader>
          <CardContent><dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Customer"><Link className="text-primary hover:underline" href={`/customers/${s.customerId}`}>{s.customer.companyName}</Link></Field>
            <Field label="Mode / container">{s.transportMode} · {s.containerType ?? "—"}</Field>
            <Field label="Shipping line">{s.shippingLine}</Field>
            <Field label="Freight forwarder">{s.freightForwarder}</Field>
            <Field label="Port of loading">{s.portOfLoading}</Field>
            <Field label="Port of discharge">{s.portOfDischarge}</Field>
            <Field label="ETD / ATD">{formatDate(s.etd)} / {formatDate(s.atd)}</Field>
            <Field label="ETA / ATA">{formatDate(s.eta)} / {formatDate(s.ata)}</Field>
            <Field label="Gross / net weight">{s.grossWeightKg ? formatKg(s.grossWeightKg) : "—"} / {s.netWeightKg ? formatKg(s.netWeightKg) : "—"}</Field>
            <Field label="Cartons">{s.cartons}</Field>
            <Field label="Tracking">{s.trackingRef ? `${s.trackingRef}${s.trackingProvider ? ` (${s.trackingProvider})` : ""}` : "—"}<div className="text-[11px] text-muted-foreground">External tracking not connected</div></Field>
          </dl>{s.notes && <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{s.notes}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Logistics costs</CardTitle><CardDescription>USD</CardDescription></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {[["Freight", s.freightCost], ["Insurance", s.insuranceCost], ["Documentation", s.documentationCost], ["Customs-related", s.customsCost]].map(([l, v]) => <div key={String(l)} className="flex justify-between"><span className="text-muted-foreground">{String(l)}</span><span className="tabular">{formatMoney(v as never)}</span></div>)}
            <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Total</span><span className="tabular">{formatMoney(logistics)}</span></div>
            {s.netWeightKg && D(s.netWeightKg).gt(0) && <div className="flex justify-between text-xs text-muted-foreground"><span>Per kg</span><span className="tabular">{formatMoney(logistics.div(D(s.netWeightKg)).toFixed(4))}</span></div>}
            {s.expenses.length > 0 && <div className="pt-2 text-xs">Linked expenses: {formatMoney(sum(s.expenses.map((e) => e.amount)))}</div>}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Related orders</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{s.orders.map(({ order: o }) => <li key={o.orderNo} className="flex justify-between py-1.5"><Link className="text-primary hover:underline" href={`/orders/${o.id}`}>{o.orderNo}</Link><StatusBadge status={o.status} /></li>)}{!s.orders.length && <li className="text-xs text-muted-foreground">No orders linked.</li>}</ul>
            {fin && s.invoices.length > 0 && <div className="mt-3 text-xs">Invoices: {s.invoices.map((i) => <Link key={i.id} className="me-2 text-primary hover:underline" href={`/invoices/${i.id}`}>{i.invoiceNo}</Link>)}</div>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Loaded goods</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{s.items.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span>{i.orderItem.variety.name} <span className="text-xs text-muted-foreground">({i.orderItem.order.orderNo})</span></span><span className="tabular">{formatKg(i.quantityKg)}</span></li>)}{!s.items.length && <li className="text-xs text-muted-foreground">Dispatch an order onto this shipment to record loaded goods.</li>}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent><ol className="relative space-y-3 border-s ps-4">{s.events.map((e) => <li key={e.id} className="text-sm"><span className="absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500" /><div className="font-medium">{label(e.status)}{e.location ? ` · ${e.location}` : ""}</div><div className="text-xs text-muted-foreground">{formatDateTime(e.occurredAt)}{e.note ? ` — ${e.note}` : ""}</div></li>)}</ol></CardContent>
        </Card>
      </div>
      <DocumentList owner={{ shipmentId: s.id }} title="Shipping documents (commercial invoice, packing list, B/L, AWB, certificates)" defaultCategory="Bill of lading" />
    </div>
  );
}
