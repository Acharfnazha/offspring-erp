import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Send, Check, X, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { formatKg, formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { convertQuotationAction, setQuotationStatusAction } from "../actions";

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("quotations:read");
  const { id } = await params;
  const q = await prisma.quotation.findUnique({ where: { id }, include: { customer: true, items: { orderBy: { sortOrder: "asc" } }, revisions: { orderBy: { revision: "desc" } }, salesOrder: true } });
  if (!q) notFound();
  const write = can(user, "quotations:write");
  const editable = ["DRAFT", "SENT", "REJECTED", "EXPIRED"].includes(q.status);
  return (
    <div className="space-y-4">
      <PageHeader title={`${q.quoteNo} · Revision ${q.revision}`} crumbs={[{ label: "Quotations", href: "/quotations" }, { label: q.quoteNo }]} description={<span className="flex items-center gap-2"><StatusBadge status={q.status} />{q.customer.companyName} · {q.incoterm} · {formatMoney(q.total, q.currency)}</span>}
        actions={<>
          <Button variant="outline" asChild><a href={`/api/pdf/quotation/${q.id}?download=1`}><Download />Download PDF</a></Button>
          {write && editable && <Button variant="outline" asChild><Link href={`/quotations/${q.id}/edit`}><Pencil />Revise</Link></Button>}
          {write && q.status === "DRAFT" && <ActionButton action={setQuotationStatusAction.bind(null, q.id, "SENT")} confirmTitle="Mark as sent to customer?"><Send />Mark sent</ActionButton>}
          {write && ["SENT", "DRAFT"].includes(q.status) && <ActionButton action={setQuotationStatusAction.bind(null, q.id, "ACCEPTED")} confirmTitle="Mark as accepted by customer?"><Check />Accepted</ActionButton>}
          {write && ["SENT", "DRAFT"].includes(q.status) && <ActionButton action={setQuotationStatusAction.bind(null, q.id, "REJECTED")} confirmTitle="Mark as rejected?"><X />Rejected</ActionButton>}
          {can(user, "sales:write") && !q.salesOrder && ["SENT", "ACCEPTED", "DRAFT"].includes(q.status) && (
            <ActionButton variant="default" action={convertQuotationAction.bind(null, q.id)} confirmTitle="Convert to sales order?" confirmText="A draft sales order is created with the quoted lines. Confirm it from the order page to reserve inventory." redirectTo="/orders/:id"><ShoppingCart />Convert to order</ActionButton>
          )}
          {q.salesOrder && <Button asChild><Link href={`/orders/${q.salesOrder.id}`}>Order {q.salesOrder.orderNo}</Link></Button>}
        </>} />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Terms</CardTitle></CardHeader>
            <CardContent><dl className="grid grid-cols-2 gap-3">
              <Field label="Customer"><Link className="text-primary hover:underline" href={`/customers/${q.customerId}`}>{q.customer.companyName}</Link></Field>
              <Field label="Issue / valid until">{formatDate(q.issueDate)} → {formatDate(q.validUntil)}</Field>
              <Field label="Incoterm">{q.incoterm}</Field><Field label="Currency">{q.currency}</Field>
              <Field label="Port of loading">{q.portOfLoading}</Field><Field label="Port of discharge">{q.portOfDischarge}</Field>
              <Field label="Payment terms">{q.paymentTerms}</Field><Field label="Delivery terms">{q.deliveryTerms}</Field>
              <Field label="Shipment">{q.shipmentDetails}</Field><Field label="Notes">{q.notes}</Field>
            </dl></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Lines</CardTitle></CardHeader>
            <CardContent><ul className="divide-y text-sm">{q.items.map((i) => <li key={i.id} className="py-2"><div className="flex justify-between gap-2"><span className="font-medium">{i.description}</span><span className="tabular">{formatMoney(i.lineTotal, q.currency)}</span></div><div className="text-xs text-muted-foreground">{label(i.grade)} · {i.origin} · {i.packaging} · {formatKg(i.quantityKg)} @ {formatMoney(i.unitPrice, q.currency)}/kg{Number(i.discountPct) > 0 ? ` · −${i.discountPct}%` : ""}</div></li>)}</ul></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Revision history</CardTitle></CardHeader>
            <CardContent><ol className="space-y-2 text-sm">{q.revisions.map((r) => <li key={r.id} className="flex justify-between gap-2"><span>Rev {r.revision} — {r.reason}</span><span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span></li>)}</ol></CardContent>
          </Card>
        </div>
        <Card className="overflow-hidden xl:col-span-3">
          <CardHeader><CardTitle>PDF preview</CardTitle></CardHeader>
          <iframe title="Quotation preview" src={`/api/pdf/quotation/${q.id}`} className="h-[820px] w-full border-t bg-muted" />
        </Card>
      </div>
    </div>
  );
}
