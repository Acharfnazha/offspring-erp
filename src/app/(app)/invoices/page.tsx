import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/data/kpi";
import { listParams, orderBy, str, type SP } from "@/lib/list-params";
import { D, formatMoney } from "@/lib/money";
import { label, opts } from "@/lib/schemas";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("finance:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["invoiceNo", "issueDate", "dueDate", "total"], "issueDate");
  const status = str(sp, "status");
  const where: Prisma.InvoiceWhereInput = {
    ...(lp.q ? { OR: [{ invoiceNo: { contains: lp.q, mode: "insensitive" } }, { customer: { companyName: { contains: lp.q, mode: "insensitive" } } }, { supplier: { name: { contains: lp.q, mode: "insensitive" } } }] } : {}),
    ...(str(sp, "type") ? { type: str(sp, "type") as never } : {}),
    ...(status === "open" ? { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } : status ? { status: status as never } : {}),
  };
  const [rows, total, agg] = await Promise.all([
    prisma.invoice.findMany({ where, include: { customer: true, supplier: true }, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where: { ...where, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { total: true, amountPaid: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Invoices" description="Sales, purchase, cold-storage, pro forma invoices and credit notes" actions={can(user, "finance:write") && <Button asChild><Link href="/invoices/new"><Plus />New invoice</Link></Button>} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi label="Invoiced (filtered)" value={formatMoney(agg._sum.total)} />
        <Kpi label="Paid / credited" value={formatMoney(agg._sum.amountPaid)} />
        <Kpi label="Outstanding" value={formatMoney(D(agg._sum.total).minus(D(agg._sum.amountPaid)))} />
      </div>
      <FilterBar placeholder="Invoice number, customer, supplier…" exportEntity="invoices" filters={[{ key: "type", label: "Type", options: opts(["SALES", "PURCHASE", "COLD_STORAGE", "PRO_FORMA", "CREDIT_NOTE"]) }, { key: "status", label: "Status", options: [{ value: "open", label: "Open (unpaid)" }, ...opts(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"])] }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} emptyTitle="No invoices"
        columns={[{ key: "no", header: "Invoice", sortKey: "invoiceNo", type: "mono" }, { key: "type", header: "Type", hideOnMobile: true }, { key: "party", header: "Customer / supplier" }, { key: "issue", header: "Issued", type: "date", sortKey: "issueDate", hideOnMobile: true }, { key: "due", header: "Due", type: "date", sortKey: "dueDate" }, { key: "total", header: "Total", type: "money", sortKey: "total" }, { key: "balance", header: "Balance", type: "money" }, { key: "status", header: "Status", type: "badge" }]}
        rows={rows.map((i) => ({ _href: `/invoices/${i.id}`, no: i.invoiceNo, type: label(i.type), party: i.customer?.companyName ?? i.supplier?.name, issue: i.issueDate.toISOString(), due: i.dueDate.toISOString(), total: i.total.toString(), balance: i.status === "CANCELLED" ? "0" : D(i.total).minus(D(i.amountPaid)).toString(), _currency: i.currency, status: i.status }))} />
    </div>
  );
}
