import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Button } from "@/components/ui/button";
import { listParams, orderBy, str, type SP } from "@/lib/list-params";
import { D } from "@/lib/money";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("suppliers:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["name", "city", "createdAt", "qualityRating"], "name", "asc");
  const where: Prisma.SupplierWhereInput = {
    archivedAt: str(sp, "archived") === "1" ? { not: null } : null,
    ...(lp.q ? { OR: [{ name: { contains: lp.q, mode: "insensitive" } }, { city: { contains: lp.q, mode: "insensitive" } }, { productsSupplied: { contains: lp.q, mode: "insensitive" } }] } : {}),
  };
  const fin = can(user, "finance:read");
  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take, include: { invoices: { where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } }, _count: { select: { purchaseOrders: true } } } }),
    prisma.supplier.count({ where }),
  ]);
  return (
    <div>
      <PageHeader title="Suppliers" description="Growers, cooperatives and packaging vendors" actions={<>
        <Button variant="outline" asChild><Link href="/suppliers/purchase-orders/new"><ClipboardList />New purchase order</Link></Button>
        {can(user, "suppliers:write") && <Button asChild><Link href="/suppliers/new"><Plus />New supplier</Link></Button>}
      </>} />
      <FilterBar placeholder="Name, region, products…" exportEntity="suppliers" filters={[{ key: "archived", label: "Records", options: [{ value: "1", label: "Archived" }] }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} emptyTitle="No suppliers yet"
        columns={[
          { key: "name", header: "Supplier", sortKey: "name" },
          { key: "city", header: "Region", sortKey: "city" },
          { key: "products", header: "Products", hideOnMobile: true },
          { key: "pos", header: "POs", type: "number" },
          { key: "rating", header: "Quality", sortKey: "qualityRating", hideOnMobile: true },
          ...(fin ? [{ key: "balance", header: "Outstanding", type: "money" as const }] : []),
        ]}
        rows={rows.map((s) => ({ _href: `/suppliers/${s.id}`, name: s.name, city: [s.city, s.country].filter(Boolean).join(", "), products: s.productsSupplied, pos: s._count.purchaseOrders, rating: s.qualityRating ? "★".repeat(s.qualityRating) : null, balance: s.invoices.reduce((a, i) => a.plus(D(i.total).minus(D(i.amountPaid))), D(0)).toFixed(2) }))}
      />
    </div>
  );
}
