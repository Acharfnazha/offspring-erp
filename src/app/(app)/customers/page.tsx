import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, Kanban } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Button } from "@/components/ui/button";
import { listParams, orderBy, str, type SP } from "@/lib/list-params";
import { CUSTOMER_TYPES, PIPELINE, label, opts } from "@/lib/schemas";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("customers:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["companyName", "country", "createdAt", "pipelineStage", "nextFollowUpAt"], "companyName", "asc");
  const q = lp.q;
  const where: Prisma.CustomerWhereInput = {
    archivedAt: str(sp, "archived") === "1" ? { not: null } : null,
    ...(q ? { OR: [{ companyName: { contains: q, mode: "insensitive" } }, { country: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { contactPerson: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
    ...(str(sp, "type") ? { type: str(sp, "type") as never } : {}),
    ...(str(sp, "stage") ? { pipelineStage: str(sp, "stage") as never } : {}),
  };
  const [rows, total, countries] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take, include: { _count: { select: { orders: true } } } }),
    prisma.customer.count({ where }),
    prisma.customer.groupBy({ by: ["country"], where: { archivedAt: null }, _count: true }),
  ]);
  return (
    <div>
      <PageHeader
        title="Customers"
        description={`International buyers & cold-storage clients across ${countries.length} countries`}
        actions={<>
          <Button variant="outline" asChild><Link href="/customers/pipeline"><Kanban />Pipeline board</Link></Button>
          {can(user, "customers:write") && <Button asChild><Link href="/customers/new"><Plus />New customer</Link></Button>}
        </>}
      />
      <FilterBar
        placeholder="Company, country, contact…"
        exportEntity="customers"
        filters={[
          { key: "type", label: "Type", options: opts(CUSTOMER_TYPES) },
          { key: "stage", label: "Stage", options: opts(PIPELINE) },
          { key: "archived", label: "Records", options: [{ value: "1", label: "Archived" }] },
        ]}
      />
      <DataTable
        total={total} page={lp.page} pageSize={lp.pageSize}
        emptyTitle="No customers yet" emptyHint="Add importers, wholesalers, supermarkets and cold-storage clients."
        columns={[
          { key: "company", header: "Company", sortKey: "companyName" },
          { key: "type", header: "Type", hideOnMobile: true },
          { key: "country", header: "Country", sortKey: "country" },
          { key: "contact", header: "Contact", hideOnMobile: true },
          { key: "orders", header: "Orders", type: "number", hideOnMobile: true },
          { key: "followUp", header: "Follow-up", type: "date", sortKey: "nextFollowUpAt", hideOnMobile: true },
          { key: "stage", header: "Stage", type: "badge", sortKey: "pipelineStage" },
        ]}
        rows={rows.map((c) => ({ _href: `/customers/${c.id}`, company: c.companyName, type: label(c.type), country: [c.city, c.country].filter(Boolean).join(", "), contact: c.contactPerson, orders: c._count.orders, followUp: c.nextFollowUpAt?.toISOString(), stage: c.pipelineStage }))}
      />
    </div>
  );
}
