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
import { D, sum } from "@/lib/money";
import { label } from "@/lib/schemas";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("finance:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["paymentNo", "paidAt", "amount"], "paidAt");
  const where: Prisma.PaymentWhereInput = {
    ...(lp.q ? { OR: [{ paymentNo: { contains: lp.q, mode: "insensitive" } }, { reference: { contains: lp.q, mode: "insensitive" } }, { customer: { companyName: { contains: lp.q, mode: "insensitive" } } }, { supplier: { name: { contains: lp.q, mode: "insensitive" } } }] } : {}),
    ...(str(sp, "direction") ? { direction: str(sp, "direction") as never } : {}),
    ...(str(sp, "method") ? { method: str(sp, "method") as never } : {}),
  };
  const [rows, total] = await Promise.all([prisma.payment.findMany({ where, include: { customer: true, supplier: true, allocations: true }, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take }), prisma.payment.count({ where })]);
  return (
    <div>
      <PageHeader title="Payments" description="Customer receipts and supplier payments with invoice allocation" actions={can(user, "finance:write") && <Button asChild><Link href="/payments/new"><Plus />Record payment</Link></Button>} />
      <FilterBar placeholder="Payment no., reference, party…" exportEntity="payments" filters={[{ key: "direction", label: "Direction", options: [{ value: "INCOMING", label: "Incoming" }, { value: "OUTGOING", label: "Outgoing" }] }, { key: "method", label: "Method", options: [{ value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "CASH", label: "Cash" }, { value: "OTHER", label: "Other" }] }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} emptyTitle="No payments recorded"
        columns={[{ key: "no", header: "Payment", sortKey: "paymentNo", type: "mono" }, { key: "dir", header: "Direction" }, { key: "party", header: "Party" }, { key: "date", header: "Date", type: "date", sortKey: "paidAt" }, { key: "method", header: "Method", hideOnMobile: true }, { key: "ref", header: "Reference", hideOnMobile: true }, { key: "amount", header: "Amount", type: "money", sortKey: "amount" }, { key: "unalloc", header: "Unallocated", type: "money", hideOnMobile: true }, { key: "status", header: "Status", type: "badge" }]}
        rows={rows.map((p) => ({ _href: `/payments/${p.id}`, no: p.paymentNo, dir: p.direction === "INCOMING" ? "In" : "Out", party: p.customer?.companyName ?? p.supplier?.name, date: p.paidAt.toISOString(), method: label(p.method), ref: p.reference, amount: p.amount.toString(), unalloc: D(p.amount).minus(sum(p.allocations.map((a) => a.amount))).toString(), _currency: p.currency, status: p.voidedAt ? "VOIDED" : "COMPLETED" }))} />
    </div>
  );
}
