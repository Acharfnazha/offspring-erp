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
import { opts } from "@/lib/schemas";

export const metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("quotations:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["quoteNo", "issueDate", "validUntil", "total", "customer.companyName"], "issueDate");
  const where: Prisma.QuotationWhereInput = {
    ...(lp.q ? { OR: [{ quoteNo: { contains: lp.q, mode: "insensitive" } }, { customer: { companyName: { contains: lp.q, mode: "insensitive" } } }] } : {}),
    ...(str(sp, "status") ? { status: str(sp, "status") as never } : {}),
  };
  const [rows, total] = await Promise.all([prisma.quotation.findMany({ where, include: { customer: true }, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take }), prisma.quotation.count({ where })]);
  return (
    <div>
      <PageHeader title="Quotations" description="Export price offers with revision history" actions={can(user, "quotations:write") && <Button asChild><Link href="/quotations/new"><Plus />New quotation</Link></Button>} />
      <FilterBar placeholder="Quote number, customer…" filters={[{ key: "status", label: "Status", options: opts(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]) }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} emptyTitle="No quotations yet"
        columns={[{ key: "no", header: "Quotation", sortKey: "quoteNo", type: "mono" }, { key: "customer", header: "Customer", sortKey: "customer.companyName" }, { key: "incoterm", header: "Incoterm", hideOnMobile: true }, { key: "issue", header: "Issued", type: "date", sortKey: "issueDate", hideOnMobile: true }, { key: "valid", header: "Valid until", type: "date", sortKey: "validUntil" }, { key: "total", header: "Total", type: "money", sortKey: "total" }, { key: "status", header: "Status", type: "badge" }]}
        rows={rows.map((q) => ({ _href: `/quotations/${q.id}`, no: `${q.quoteNo} r${q.revision}`, customer: q.customer.companyName, incoterm: q.incoterm, issue: q.issueDate.toISOString(), valid: q.validUntil.toISOString(), total: q.total.toString(), _currency: q.currency, status: q.status }))} />
    </div>
  );
}
