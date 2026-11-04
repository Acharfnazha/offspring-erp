import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { listParams, str, type SP } from "@/lib/list-params";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("audit:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["createdAt"], "createdAt");
  const where: Prisma.AuditLogWhereInput = {
    ...(lp.q ? { OR: [{ summary: { contains: lp.q, mode: "insensitive" } }, { action: { contains: lp.q, mode: "insensitive" } }, { user: { name: { contains: lp.q, mode: "insensitive" } } }] } : {}),
    ...(str(sp, "entity") ? { entity: str(sp, "entity") } : {}),
  };
  const [rows, total, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: lp.dir }, skip: lp.skip, take: lp.take }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: true }),
  ]);
  return (
    <div>
      <PageHeader title="Audit log" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Audit log" }]} description="Append-only: the database rejects updates and deletes on this table." />
      <FilterBar placeholder="Action, summary, user…" filters={[{ key: "entity", label: "Entity", options: entities.map((e) => ({ value: e.entity, label: `${e.entity} (${e._count})` })) }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} columns={[{ key: "when", header: "When", sortKey: "createdAt" }, { key: "user", header: "User" }, { key: "action", header: "Action", type: "mono" }, { key: "entity", header: "Entity" }, { key: "summary", header: "Summary" }]}
        rows={rows.map((a) => ({ when: formatDateTime(a.createdAt), user: a.user?.name ?? "System", action: a.action, entity: a.entity, summary: a.summary }))} />
    </div>
  );
}
