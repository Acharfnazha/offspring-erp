import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { str, type SP } from "@/lib/list-params";
import { formatKg } from "@/lib/money";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const q = (str(await searchParams, "q") ?? "").slice(0, 100);
  const c = { contains: q, mode: "insensitive" as const };
  const none = Promise.resolve([] as never[]);
  const [customers, suppliers, batches, orders, quotes, invoices, shipments] = q.length < 2 ? [[], [], [], [], [], [], []] : await Promise.all([
    can(user, "customers:read") ? prisma.customer.findMany({ where: { OR: [{ companyName: c }, { country: c }, { city: c }, { code: c }, { contactPerson: c }] }, take: 8 }) : none,
    can(user, "suppliers:read") ? prisma.supplier.findMany({ where: { OR: [{ name: c }, { city: c }, { code: c }] }, take: 8 }) : none,
    can(user, "inventory:read") ? prisma.inventoryBatch.findMany({ where: { OR: [{ batchNo: c }, { variety: { name: c } }] }, include: { variety: true }, take: 8, orderBy: { arrivalDate: "desc" } }) : none,
    can(user, "sales:read") ? prisma.salesOrder.findMany({ where: { OR: [{ orderNo: c }, { customer: { companyName: c } }] }, include: { customer: true }, take: 8 }) : none,
    can(user, "quotations:read") ? prisma.quotation.findMany({ where: { OR: [{ quoteNo: c }, { customer: { companyName: c } }] }, include: { customer: true }, take: 8 }) : none,
    can(user, "finance:read") ? prisma.invoice.findMany({ where: { OR: [{ invoiceNo: c }, { customer: { companyName: c } }, { supplier: { name: c } }] }, include: { customer: true, supplier: true }, take: 8 }) : none,
    can(user, "shipments:read") ? prisma.shipment.findMany({ where: { OR: [{ shipmentNo: c }, { containerNo: c }, { customer: { companyName: c } }, { portOfDischarge: c }] }, include: { customer: true }, take: 8 }) : none,
  ]);
  const groups: { title: string; items: { href: string; label: string; sub?: string; status?: string }[] }[] = [
    { title: "Customers", items: customers.map((x) => ({ href: `/customers/${x.id}`, label: x.companyName, sub: x.country })) },
    { title: "Suppliers", items: suppliers.map((x) => ({ href: `/suppliers/${x.id}`, label: x.name, sub: x.city ?? "" })) },
    { title: "Inventory batches", items: batches.map((x) => ({ href: `/inventory/${x.id}`, label: `${x.batchNo} · ${x.variety.name}`, sub: formatKg(x.onHandKg), status: x.status })) },
    { title: "Sales orders", items: orders.map((x) => ({ href: `/orders/${x.id}`, label: x.orderNo, sub: x.customer.companyName, status: x.status })) },
    { title: "Quotations", items: quotes.map((x) => ({ href: `/quotations/${x.id}`, label: x.quoteNo, sub: x.customer.companyName, status: x.status })) },
    { title: "Invoices", items: invoices.map((x) => ({ href: `/invoices/${x.id}`, label: x.invoiceNo, sub: x.customer?.companyName ?? x.supplier?.name, status: x.status })) },
    { title: "Shipments", items: shipments.map((x) => ({ href: `/shipments/${x.id}`, label: `${x.shipmentNo}${x.containerNo ? ` · ${x.containerNo}` : ""}`, sub: x.customer.companyName, status: x.status })) },
  ].filter((g) => g.items.length);
  return (
    <div>
      <PageHeader title={q ? `Results for “${q}”` : "Search"} description={q.length < 2 ? "Type at least 2 characters in the search bar." : `${groups.reduce((a, g) => a + g.items.length, 0)} matches across records you can access`} />
      {q.length >= 2 && groups.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title}><CardHeader><CardTitle>{g.title}</CardTitle></CardHeader><CardContent><ul className="divide-y text-sm">{g.items.map((i) => <li key={i.href}><Link href={i.href} className="flex items-center justify-between gap-2 py-2 hover:text-primary"><span><span className="font-medium">{i.label}</span> <span className="text-xs text-muted-foreground">{i.sub}</span></span>{i.status && <StatusBadge status={i.status} />}</Link></li>)}</ul></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
