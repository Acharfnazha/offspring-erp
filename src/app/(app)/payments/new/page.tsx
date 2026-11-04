import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { customerOptions, supplierOptions } from "@/lib/options";
import { businessDate, isoDate } from "@/lib/dates";
import { D } from "@/lib/money";
import { str, type SP } from "@/lib/list-params";
import { PaymentForm, type OpenInvoice } from "./payment-form";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("finance:write");
  const sp = await searchParams;
  const [customers, suppliers, invs] = await Promise.all([customerOptions(), supplierOptions(), prisma.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] }, type: { not: "CREDIT_NOTE" } }, orderBy: { dueDate: "asc" } })]);
  const invoices: OpenInvoice[] = invs.map((i) => ({ id: i.id, no: i.invoiceNo, partyId: (i.type === "PURCHASE" ? i.supplierId : i.customerId) ?? "", direction: i.type === "PURCHASE" ? "OUTGOING" : "INCOMING", currency: i.currency, balance: D(i.total).minus(D(i.amountPaid)).toFixed(2), due: isoDate(i.dueDate), status: i.status }));
  const pre = invoices.find((i) => i.id === str(sp, "invoice"));
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Record payment" crumbs={[{ label: "Payments", href: "/payments" }, { label: "New" }]} description="Each submission carries a unique key so a double-click or retry can never post the same payment twice." />
      <PaymentForm customers={customers} suppliers={suppliers} invoices={invoices} today={businessDate()} preset={pre ? { direction: pre.direction, partyId: pre.partyId, invoiceId: pre.id } : undefined} />
    </div>
  );
}
