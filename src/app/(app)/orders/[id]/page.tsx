import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileText, Ship, XCircle, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { D, formatKg, formatMoney, sum } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { cancelOrderAction, confirmOrderAction, invoiceOrderAction, overrideConfirmAction } from "../actions";
import { DispatchDialog } from "./dispatch-dialog";
import { availableByVariety } from "@/lib/services/inventory";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("sales:read");
  const { id } = await params;
  const o = await prisma.salesOrder.findUnique({
    where: { id },
    include: { customer: true, quotation: true, items: { include: { variety: { include: { product: true } }, reservations: { include: { batch: true } } } }, invoices: { orderBy: { createdAt: "desc" } }, shipments: { include: { shipment: true } }, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!o) notFound();
  const write = can(user, "sales:write");
  const fin = can(user, "finance:read");
  const availability = o.status === "DRAFT" ? await Promise.all(o.items.map((i) => availableByVariety(i.varietyId, i.grade))) : [];
  const short = availability.some((a, idx) => a.lt(D(o.items[idx].quantityKg)));
  const openShipments = can(user, "inventory:write") && ["CONFIRMED", "PARTIALLY_FULFILLED"].includes(o.status)
    ? await prisma.shipment.findMany({ where: { customerId: o.customerId, status: { in: ["PLANNING", "PACKING", "READY_FOR_DISPATCH"] } }, orderBy: { createdAt: "desc" } }) : [];
  const cogs = sum(o.items.map((i) => i.cogsAmount));
  const dispatchedValue = sum(o.items.map((i) => D(i.fulfilledKg).mul(D(i.unitPrice)).mul(D(100).minus(D(i.discountPct))).div(100)));
  const hasSalesInvoice = o.invoices.some((i) => i.type === "SALES" && i.status !== "CANCELLED");
  return (
    <div className="space-y-4">
      <PageHeader title={o.orderNo} crumbs={[{ label: "Sales & Orders", href: "/orders" }, { label: o.orderNo }]} description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={o.status} />{o.customer.companyName} · {o.incoterm} · {formatMoney(o.total, o.currency)}</span>}
        actions={<>
          {write && o.status === "DRAFT" && !short && <ActionButton variant="default" action={confirmOrderAction.bind(null, o.id, false, undefined)} confirmTitle="Confirm order?" confirmText="Inventory will be reserved using the configured FEFO/FIFO strategy."><CheckCircle2 />Confirm & reserve</ActionButton>}
          {write && o.status === "DRAFT" && short && can(user, "sales:override") && <ActionButton destructive action={overrideConfirmAction.bind(null, o.id)} confirmTitle="Confirm with inventory override?" confirmText="Available stock does not cover this order. Available quantities will be reserved and the shortfall recorded with your reason." reasonLabel="Override reason (required)"><ShieldAlert />Confirm with override</ActionButton>}
          {can(user, "inventory:write") && ["CONFIRMED", "PARTIALLY_FULFILLED"].includes(o.status) && (
            <DispatchDialog orderId={o.id} shipments={openShipments.map((s) => ({ value: s.id, label: `${s.shipmentNo} · ${s.containerNo ?? "no container"} · ${label(s.status)}` }))}
              items={o.items.filter((i) => D(i.fulfilledKg).lt(D(i.quantityKg))).map((i) => ({ id: i.id, name: `${i.variety.name} (${label(i.grade)})`, outstanding: D(i.quantityKg).minus(D(i.fulfilledKg)).toFixed(3), reserved: sum(i.reservations.filter((r) => r.status === "ACTIVE").map((r) => D(r.quantityKg).minus(D(r.fulfilledKg)))).toFixed(3) }))} />
          )}
          {can(user, "shipments:write") && ["CONFIRMED", "PARTIALLY_FULFILLED", "FULFILLED"].includes(o.status) && <Button variant="outline" asChild><Link href={`/shipments/new?order=${o.id}`}><Ship />Create shipment</Link></Button>}
          {can(user, "finance:write") && o.status !== "DRAFT" && o.status !== "CANCELLED" && <ActionButton action={invoiceOrderAction.bind(null, o.id, "PRO_FORMA")} confirmTitle="Create pro forma invoice?" redirectTo="/invoices/:id"><FileText />Pro forma</ActionButton>}
          {can(user, "finance:write") && o.status !== "DRAFT" && o.status !== "CANCELLED" && !hasSalesInvoice && <ActionButton variant="default" action={invoiceOrderAction.bind(null, o.id, "SALES")} confirmTitle="Create sales invoice?" confirmText="Uses dispatched quantities when goods were dispatched, otherwise ordered quantities." redirectTo="/invoices/:id"><FileText />Create invoice</ActionButton>}
          {write && o.status !== "CANCELLED" && o.items.every((i) => D(i.fulfilledKg).eq(0)) && <ActionButton destructive action={cancelOrderAction.bind(null, o.id)} confirmTitle="Cancel order?" confirmText="All active reservations are released." reasonLabel="Cancellation reason"><XCircle />Cancel</ActionButton>}
        </>} />
      {o.status === "DRAFT" && short && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Available inventory does not cover all lines. {can(user, "sales:override") ? "Confirming requires an authorized override with a reason." : "A Sales Manager or Administrator must authorize an override."}</div>}
      {o.overrideReason && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm"><b>Inventory override recorded:</b> {o.overrideReason}</div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Order terms</CardTitle></CardHeader>
          <CardContent><dl className="grid grid-cols-2 gap-3">
            <Field label="Customer"><Link className="text-primary hover:underline" href={`/customers/${o.customerId}`}>{o.customer.companyName}</Link></Field>
            <Field label="Order date">{formatDate(o.orderDate)}</Field>
            <Field label="Incoterm">{o.incoterm}</Field>
            <Field label="Expected shipment">{formatDate(o.expectedShipmentDate)}</Field>
            <Field label="Currency / rate">{o.currency} · {D(o.exchangeRate).toString()}</Field>
            <Field label="From quotation">{o.quotation ? <Link className="text-primary hover:underline" href={`/quotations/${o.quotation.id}`}>{o.quotation.quoteNo}</Link> : "—"}</Field>
            <Field label="Payment terms">{o.paymentTerms}</Field>
            <Field label="Delivery terms">{o.deliveryTerms}</Field>
          </dl>{o.notes && <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{o.notes}</p>}</CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Lines, reservations & fulfilment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {o.items.map((i, idx) => (
              <div key={i.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><div className="font-medium">{i.variety.product.name} — {i.variety.name}</div><div className="text-xs text-muted-foreground">{label(i.grade)}{i.packaging ? ` · ${i.packaging}` : ""} · {formatKg(i.quantityKg)} @ {formatMoney(i.unitPrice, o.currency)}/kg{Number(i.discountPct) ? ` −${i.discountPct}%` : ""}</div></div>
                  <div className="text-end"><div className="font-semibold tabular">{formatMoney(i.lineTotal, o.currency)}</div><div className="text-xs text-muted-foreground tabular">{formatKg(i.fulfilledKg)} dispatched</div></div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, D(i.fulfilledKg).div(D(i.quantityKg)).mul(100).toNumber())}%` }} /></div>
                {o.status === "DRAFT" && <div className={`mt-2 text-xs ${availability[idx]?.lt(D(i.quantityKg)) ? "text-red-600" : "text-muted-foreground"}`}>Available now: {formatKg(availability[idx])}</div>}
                {i.reservations.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{i.reservations.map((r) => <Link key={r.id} href={`/inventory/${r.batchId}`}><Badge variant={r.status === "ACTIVE" ? "info" : r.status === "FULFILLED" ? "success" : "muted"}>{r.batch.batchNo}: {D(r.quantityKg).toFixed(0)} kg · {r.status.toLowerCase()}</Badge></Link>)}</div>}
              </div>
            ))}
            <div className="ms-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular">{formatMoney(o.subtotal, o.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discounts</span><span className="tabular">−{formatMoney(o.discountTotal, o.currency)}</span></div>
              <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="tabular">{formatMoney(o.total, o.currency)}</span></div>
              {fin && cogs.gt(0) && <div className="flex justify-between pt-2 text-xs"><span className="text-muted-foreground">Dispatched value / COGS / gross profit</span><span className="tabular">{formatMoney(dispatchedValue, o.currency)} / {formatMoney(cogs)} / {formatMoney(dispatchedValue.div(D(o.exchangeRate)).minus(cogs))}</span></div>}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{o.invoices.map((i) => <li key={i.id} className="flex justify-between py-1.5">{fin ? <Link className="text-primary hover:underline" href={`/invoices/${i.id}`}>{i.invoiceNo}</Link> : i.invoiceNo}<span className="flex items-center gap-2">{label(i.type)} <StatusBadge status={i.status} /></span></li>)}{!o.invoices.length && <li className="text-xs text-muted-foreground">Not invoiced yet.</li>}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Shipments</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{o.shipments.map(({ shipment: s }) => <li key={s.id} className="flex justify-between py-1.5"><Link className="text-primary hover:underline" href={`/shipments/${s.id}`}>{s.shipmentNo}</Link><StatusBadge status={s.status} /></li>)}{!o.shipments.length && <li className="text-xs text-muted-foreground">No shipment linked.</li>}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
          <CardContent><ol className="space-y-2 text-sm">{o.events.map((e) => <li key={e.id}><div className="font-medium">{label(e.type)}</div><div className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}{e.note ? ` · ${e.note}` : ""}</div></li>)}</ol></CardContent>
        </Card>
      </div>
    </div>
  );
}
