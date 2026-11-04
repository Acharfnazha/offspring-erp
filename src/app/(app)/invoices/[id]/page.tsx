import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Send, XCircle, Wallet, MinusCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { ActionDialog } from "@/components/forms/action-dialog";
import { DocumentList } from "@/components/data/document-list";
import { D, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { cancelInvoiceAction, creditNoteAction, issueInvoiceAction } from "../actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("finance:read");
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { customer: true, supplier: true, items: { orderBy: { sortOrder: "asc" } }, salesOrder: true, storageContract: true, shipment: true, originalInvoice: true, creditNotes: true, allocations: { include: { payment: true } } } });
  if (!inv) notFound();
  const write = can(user, "finance:write");
  const balance = D(inv.total).minus(D(inv.amountPaid));
  const payable = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status) && inv.type !== "CREDIT_NOTE";
  const party = inv.customer ? { href: `/customers/${inv.customer.id}`, name: inv.customer.companyName } : inv.supplier ? { href: `/suppliers/${inv.supplier.id}`, name: inv.supplier.name } : null;
  return (
    <div className="space-y-4">
      <PageHeader title={inv.invoiceNo} crumbs={[{ label: "Invoices", href: "/invoices" }, { label: inv.invoiceNo }]} description={<span className="flex items-center gap-2"><StatusBadge status={inv.status} />{label(inv.type)} · {party?.name} · {formatMoney(inv.total, inv.currency)}</span>}
        actions={<>
          <Button variant="outline" asChild><a href={`/api/pdf/invoice/${inv.id}?download=1`}><Download />Download PDF</a></Button>
          {write && inv.status === "DRAFT" && <ActionButton variant="default" action={issueInvoiceAction.bind(null, inv.id)} confirmTitle="Issue invoice?" confirmText="Issued invoices count towards receivables/payables and can receive payments."><Send />Issue</ActionButton>}
          {write && payable && <Button asChild><Link href={`/payments/new?invoice=${inv.id}`}><Wallet />Record payment</Link></Button>}
          {write && payable && <ActionDialog trigger={<Button variant="outline"><MinusCircle />Credit note</Button>} title="Issue credit note" description={`Reduces the open balance (${formatMoney(balance, inv.currency)}). The credit note is applied to this invoice immediately.`} fields={[{ name: "amount", label: `Amount (${inv.currency})`, type: "number", required: true }, { name: "reason", label: "Reason", type: "textarea", required: true }]} onSubmit={creditNoteAction.bind(null, inv.id)} />}
          {write && inv.status !== "CANCELLED" && D(inv.amountPaid).eq(0) && <ActionButton destructive action={cancelInvoiceAction.bind(null, inv.id)} confirmTitle="Cancel invoice?" confirmText="Cancelled invoices are retained for audit and excluded from balances." reasonLabel="Reason"><XCircle />Cancel</ActionButton>}
        </>} />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3">
                <Field label={inv.supplier ? "Supplier" : "Customer"}>{party && <Link className="text-primary hover:underline" href={party.href}>{party.name}</Link>}</Field>
                <Field label="Issue / due">{formatDate(inv.issueDate)} → {formatDate(inv.dueDate)}</Field>
                <Field label="Source">{inv.salesOrder ? <Link className="text-primary hover:underline" href={`/orders/${inv.salesOrder.id}`}>{inv.salesOrder.orderNo}</Link> : inv.storageContract ? <Link className="text-primary hover:underline" href={`/cold-storage/contracts/${inv.storageContract.id}`}>{inv.storageContract.contractNo}</Link> : inv.originalInvoice ? <Link className="text-primary hover:underline" href={`/invoices/${inv.originalInvoice.id}`}>{inv.originalInvoice.invoiceNo}</Link> : "Manual"}</Field>
                <Field label="Shipment">{inv.shipment ? <Link className="text-primary hover:underline" href={`/shipments/${inv.shipment.id}`}>{inv.shipment.shipmentNo}</Link> : "—"}</Field>
                <Field label="Currency / rate">{inv.currency} · {D(inv.exchangeRate).toString()}</Field>
                <Field label="Incoterm">{inv.incoterm}</Field>
              </dl>
              <div className="mt-4 space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                {[["Subtotal", inv.subtotal], ["Discounts", D(inv.discountTotal).neg()], ["Tax", inv.taxTotal]].map(([l, v]) => <div key={String(l)} className="flex justify-between"><span className="text-muted-foreground">{String(l)}</span><span className="tabular">{formatMoney(v as never, inv.currency)}</span></div>)}
                <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="tabular">{formatMoney(inv.total, inv.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid / credited</span><span className="tabular">{formatMoney(inv.amountPaid, inv.currency)}</span></div>
                <div className="flex justify-between text-base font-semibold"><span>Balance due</span><span className="tabular" data-testid="invoice-balance">{formatMoney(inv.status === "CANCELLED" ? 0 : balance, inv.currency)}</span></div>
              </div>
              {inv.cancelReason && <p className="mt-3 text-xs text-red-600">Cancelled: {inv.cancelReason}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payments & credits</CardTitle></CardHeader>
            <CardContent><ul className="divide-y text-sm">
              {inv.allocations.map((a) => <li key={a.id} className="flex justify-between py-1.5"><Link className="text-primary hover:underline" href={`/payments/${a.paymentId}`}>{a.payment.paymentNo}</Link><span className="tabular">{formatDate(a.payment.paidAt)} · {formatMoney(a.amount, inv.currency)}{a.payment.voidedAt && " (void)"}</span></li>)}
              {inv.creditNotes.map((c) => <li key={c.id} className="flex justify-between py-1.5"><Link className="text-primary hover:underline" href={`/invoices/${c.id}`}>{c.invoiceNo}</Link><span className="tabular">Credit · {formatMoney(c.total, inv.currency)} <StatusBadge status={c.status} /></span></li>)}
              {!inv.allocations.length && !inv.creditNotes.length && <li className="text-xs text-muted-foreground">No payments recorded.</li>}
            </ul></CardContent>
          </Card>
          <DocumentList owner={{ invoiceId: inv.id }} />
        </div>
        <Card className="overflow-hidden xl:col-span-3">
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <iframe title="Invoice preview" src={`/api/pdf/invoice/${inv.id}`} className="h-[820px] w-full border-t bg-muted" />
        </Card>
      </div>
    </div>
  );
}
