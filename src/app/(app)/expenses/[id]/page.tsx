import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, X, Banknote } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { DocumentList } from "@/components/data/document-list";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { archiveExpenseAction, setExpenseStatusAction } from "../actions";

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("expenses:read");
  const { id } = await params;
  const e = await prisma.expense.findUnique({ where: { id }, include: { approvedBy: true, createdBy: true, shipment: true } });
  if (!e) notFound();
  const approve = can(user, "expenses:approve");
  return (
    <div className="space-y-4">
      <PageHeader title={`${e.expenseNo} · ${e.description}`} crumbs={[{ label: "Expenses", href: "/expenses" }, { label: e.expenseNo }]} description={<span className="flex items-center gap-2"><StatusBadge status={e.status} />{label(e.category)} · {formatMoney(e.amount, e.currency)}</span>}
        actions={approve && <>
          {["PENDING", "REJECTED"].includes(e.status) && <ActionButton variant="default" action={setExpenseStatusAction.bind(null, e.id, "APPROVED")} confirmTitle="Approve expense?"><Check />Approve</ActionButton>}
          {e.status === "PENDING" && <ActionButton destructive action={setExpenseStatusAction.bind(null, e.id, "REJECTED")} confirmTitle="Reject expense?" reasonLabel="Reason"><X />Reject</ActionButton>}
          {e.status === "APPROVED" && <ActionButton action={setExpenseStatusAction.bind(null, e.id, "PAID")} confirmTitle="Mark as paid?"><Banknote />Mark paid</ActionButton>}
          {e.status !== "PAID" && <ActionButton action={archiveExpenseAction.bind(null, e.id)} confirmTitle="Archive expense?" redirectTo="/expenses">Archive</ActionButton>}
        </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent><dl className="grid gap-3">
          <Field label="Date">{formatDate(e.date)}</Field><Field label="Vendor">{e.vendor}</Field><Field label="Amount">{formatMoney(e.amount, e.currency)}</Field>
          <Field label="Shipment">{e.shipment ? <Link className="text-primary hover:underline" href={`/shipments/${e.shipment.id}`}>{e.shipment.shipmentNo}</Link> : "—"}</Field>
          <Field label="Submitted by">{e.createdBy?.name} · {formatDateTime(e.createdAt)}</Field>
          <Field label="Approval">{e.approvedBy ? `${e.approvedBy.name} · ${formatDateTime(e.approvedAt)}` : "Awaiting approval"}</Field>
          <Field label="Notes">{e.notes}</Field>
        </dl></CardContent></Card>
        <div className="lg:col-span-2"><DocumentList owner={{ expenseId: e.id }} title="Receipts & attachments" defaultCategory="Receipt" /></div>
      </div>
    </div>
  );
}
