import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Split, Ban } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { ActionDialog } from "@/components/forms/action-dialog";
import { D, formatMoney, sum } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { allocatePaymentAction, voidPaymentAction } from "../actions";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("finance:read");
  const { id } = await params;
  const p = await prisma.payment.findUnique({ where: { id }, include: { customer: true, supplier: true, allocations: { include: { invoice: true } } } });
  if (!p) notFound();
  const write = can(user, "finance:write");
  const unallocated = D(p.amount).minus(sum(p.allocations.map((a) => a.amount)));
  const open = write && unallocated.gt(0) && !p.voidedAt ? await prisma.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, currency: p.currency, ...(p.direction === "INCOMING" ? { customerId: p.customerId, type: { in: ["SALES", "COLD_STORAGE", "PRO_FORMA"] } } : { supplierId: p.supplierId, type: "PURCHASE" }) }, orderBy: { dueDate: "asc" } }) : [];
  return (
    <div className="space-y-4">
      <PageHeader title={p.paymentNo} crumbs={[{ label: "Payments", href: "/payments" }, { label: p.paymentNo }]} description={<span className="flex items-center gap-2"><StatusBadge status={p.voidedAt ? "VOIDED" : "COMPLETED"} label={p.voidedAt ? "Voided" : "Posted"} />{p.direction === "INCOMING" ? "Received from" : "Paid to"} {p.customer?.companyName ?? p.supplier?.name} · {formatMoney(p.amount, p.currency)}</span>}
        actions={<>
          <Button variant="outline" asChild><a href={`/api/pdf/receipt/${p.id}`} target="_blank"><Download />{p.direction === "INCOMING" ? "Receipt" : "Voucher"} PDF</a></Button>
          {open.length > 0 && <ActionDialog trigger={<Button><Split />Allocate</Button>} title="Allocate unallocated funds" description={`${formatMoney(unallocated, p.currency)} available.`} fields={[{ name: "invoiceId", label: "Invoice", type: "select", options: open.map((i) => ({ value: i.id, label: `${i.invoiceNo} — balance ${D(i.total).minus(D(i.amountPaid)).toFixed(2)}` })) }, { name: "amount", label: "Amount", type: "number", defaultValue: Decimalmin(unallocated, D(open[0].total).minus(D(open[0].amountPaid))), required: true }]} onSubmit={allocatePaymentAction.bind(null, p.id)} />}
          {write && !p.voidedAt && <ActionButton destructive action={voidPaymentAction.bind(null, p.id)} confirmTitle="Void payment?" confirmText="Allocations are reversed and invoice balances restored. The record is kept for audit." reasonLabel="Reason"><Ban />Void</ActionButton>}
        </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
          <CardContent><dl className="grid gap-3">
            <Field label="Party">{p.customer ? <Link className="text-primary hover:underline" href={`/customers/${p.customer.id}`}>{p.customer.companyName}</Link> : p.supplier ? <Link className="text-primary hover:underline" href={`/suppliers/${p.supplier.id}`}>{p.supplier.name}</Link> : "—"}</Field>
            <Field label="Date">{formatDate(p.paidAt)}</Field>
            <Field label="Method">{label(p.method)}</Field>
            <Field label="Reference">{p.reference}</Field>
            <Field label="Amount">{formatMoney(p.amount, p.currency)}</Field>
            <Field label="Unallocated (on account)">{formatMoney(unallocated, p.currency)}</Field>
            <Field label="Recorded">{formatDateTime(p.createdAt)}</Field>
            {p.voidedAt && <Field label="Voided">{formatDateTime(p.voidedAt)} — {p.voidReason}</Field>}
            <Field label="Notes">{p.notes}</Field>
          </dl></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Allocations</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{p.allocations.map((a) => <li key={a.id} className="flex justify-between py-2"><Link className="text-primary hover:underline" href={`/invoices/${a.invoiceId}`}>{a.invoice.invoiceNo}</Link><span className="flex items-center gap-2 tabular">{formatMoney(a.amount, p.currency)} <StatusBadge status={a.invoice.status} /></span></li>)}{!p.allocations.length && <li className="text-xs text-muted-foreground">Not allocated — held as advance payment.</li>}</ul></CardContent>
        </Card>
      </div>
    </div>
  );
}

function Decimalmin(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return (a.lt(b) ? a : b).toFixed(2);
}
