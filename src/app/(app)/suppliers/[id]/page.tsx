import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { DocumentList } from "@/components/data/document-list";
import { D, formatKg, formatMoney, sum } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { archiveSupplierAction } from "../actions";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("suppliers:read");
  const { id } = await params;
  const fin = can(user, "finance:read");
  const s = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchaseOrders: { orderBy: { orderDate: "desc" }, include: { items: { include: { variety: true } } } },
      batches: { orderBy: { arrivalDate: "desc" }, take: 20, include: { variety: true } },
      invoices: { where: { status: { not: "CANCELLED" } }, orderBy: { issueDate: "desc" } },
      payments: { where: { voidedAt: null }, orderBy: { paidAt: "desc" } },
    },
  });
  if (!s) notFound();
  const write = can(user, "suppliers:write");
  const purchased = sum(s.invoices.filter((i) => i.type === "PURCHASE").map((i) => i.total));
  const outstanding = sum(s.invoices.filter((i) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status)).map((i) => D(i.total).minus(D(i.amountPaid))));
  const kg = sum(s.purchaseOrders.flatMap((p) => p.items.map((i) => i.receivedKg)));
  return (
    <div className="space-y-4">
      <PageHeader title={s.name} crumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: s.code }]} description={[s.city, s.country].filter(Boolean).join(", ")} actions={<>
        {fin && <Button variant="outline" asChild><a href={`/api/pdf/statement/${s.id}?party=supplier`} target="_blank"><FileSpreadsheet />Statement</a></Button>}
        {write && <Button variant="outline" asChild><Link href={`/suppliers/purchase-orders/new?supplier=${s.id}`}><Plus />Purchase order</Link></Button>}
        {write && <Button variant="outline" asChild><Link href={`/suppliers/${s.id}/edit`}><Pencil />Edit</Link></Button>}
        {write && <ActionButton action={archiveSupplierAction.bind(null, s.id, !s.archivedAt)} confirmTitle={s.archivedAt ? "Restore supplier?" : "Archive supplier?"}>{s.archivedAt ? "Restore" : "Archive"}</ActionButton>}
      </>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Received volume</div><div className="mt-1 text-lg font-semibold tabular">{formatKg(kg)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Purchase orders</div><div className="mt-1 text-lg font-semibold tabular">{s.purchaseOrders.length}</div></Card>
        {fin && <Card className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total purchases</div><div className="mt-1 text-lg font-semibold tabular">{formatMoney(purchased)}</div></Card>}
        {fin && <Card className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Outstanding balance</div><div className="mt-1 text-lg font-semibold tabular">{formatMoney(outstanding)}</div></Card>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-3">
              <Field label="Contact">{s.contactPerson}</Field>
              <Field label="Email / phone">{[s.email, s.phone, s.whatsapp].filter(Boolean).join(" · ")}</Field>
              <Field label="Products supplied">{s.productsSupplied}</Field>
              <Field label="Payment terms">{s.paymentTermsDays} days</Field>
              <Field label="Quality rating">{s.qualityRating ? "★".repeat(s.qualityRating) + "☆".repeat(5 - s.qualityRating) : "—"}</Field>
              <Field label="Pricing notes">{s.pricingNotes}</Field>
              <Field label="Quality notes">{s.qualityNotes}</Field>
            </dl>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Purchase orders</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-start">PO</th><th className="px-4 py-2 text-start">Date</th><th className="px-4 py-2 text-start">Items</th><th className="px-4 py-2 text-end">Ordered / received</th><th className="px-4 py-2 text-end">Status</th></tr></thead>
              <tbody>
                {s.purchaseOrders.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2"><Link className="text-primary hover:underline" href={`/suppliers/purchase-orders/${p.id}`}>{p.poNo}</Link></td>
                    <td className="px-4 py-2">{formatDate(p.orderDate)}</td>
                    <td className="px-4 py-2 text-xs">{p.items.map((i) => i.variety.name).join(", ")}</td>
                    <td className="px-4 py-2 text-end tabular text-xs">{formatKg(sum(p.items.map((i) => i.quantityKg)))} / {formatKg(sum(p.items.map((i) => i.receivedKg)))}</td>
                    <td className="px-4 py-2 text-end"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {s.purchaseOrders.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">No purchase orders.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
      {fin && (
        <Card>
          <CardHeader><CardTitle>Supplier invoices & payments</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <ul className="divide-y text-sm">{s.invoices.map((i) => <li key={i.id} className="flex justify-between py-1.5"><Link className="text-primary hover:underline" href={`/invoices/${i.id}`}>{i.invoiceNo}</Link><span className="flex items-center gap-2 tabular">{formatMoney(D(i.total).minus(D(i.amountPaid)))} <StatusBadge status={i.status} /></span></li>)}</ul>
            <ul className="divide-y text-sm">{s.payments.map((p) => <li key={p.id} className="flex justify-between py-1.5"><Link className="text-primary hover:underline" href={`/payments/${p.id}`}>{p.paymentNo}</Link><span className="tabular">{formatDate(p.paidAt)} · {formatMoney(p.amount)}</span></li>)}</ul>
          </CardContent>
        </Card>
      )}
      <DocumentList owner={{ supplierId: s.id }} />
    </div>
  );
}
