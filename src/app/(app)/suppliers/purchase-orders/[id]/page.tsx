import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { D, formatKg, formatMoney, sum } from "@/lib/money";
import { businessDate, formatDate } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { roomOptions } from "@/lib/options";
import { ReceiveForm } from "./receive-form";
import { cancelPurchaseOrderAction } from "../../actions";

export default async function POPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("suppliers:read");
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { supplier: true, items: { include: { variety: true } }, receipts: { include: { batches: { include: { variety: true, coldRoom: true } } }, orderBy: { receivedAt: "desc" } }, invoices: true } });
  if (!po) notFound();
  const write = can(user, "suppliers:write") && can(user, "inventory:write");
  const open = !["RECEIVED", "CANCELLED"].includes(po.status);
  const rooms = write && open ? await roomOptions() : [];
  const total = sum(po.items.map((i) => D(i.quantityKg).mul(D(i.unitCostKg))));
  return (
    <div className="space-y-4">
      <PageHeader title={po.poNo} crumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: po.supplier.name, href: `/suppliers/${po.supplierId}` }, { label: po.poNo }]} description={<StatusBadge status={po.status} />} actions={<>
        {write && open && <ReceiveForm poId={po.id} rooms={rooms} today={businessDate()} items={po.items.filter((i) => D(i.receivedKg).lt(D(i.quantityKg))).map((i) => ({ id: i.id, name: `${i.variety.name} (${label(i.grade)})`, grade: i.grade, outstanding: D(i.quantityKg).minus(D(i.receivedKg)).toFixed(3) }))} />}
        {write && po.status !== "CANCELLED" && po.items.every((i) => D(i.receivedKg).eq(0)) && <ActionButton destructive action={cancelPurchaseOrderAction.bind(null, po.id)} confirmTitle="Cancel purchase order?" reasonLabel="Reason">Cancel PO</ActionButton>}
      </>} />
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-5 md:grid-cols-4">
          <Field label="Supplier">{po.supplier.name}</Field><Field label="Order date">{formatDate(po.orderDate)}</Field><Field label="Expected">{formatDate(po.expectedDate)}</Field>
          {can(user, "finance:read") && <Field label="PO value">{formatMoney(total, po.currency)}</Field>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Lines</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-start">Variety</th><th className="px-4 py-2 text-start">Grade</th><th className="px-4 py-2 text-end">Ordered</th><th className="px-4 py-2 text-end">Received</th><th className="px-4 py-2 text-end">Cost/kg</th></tr></thead>
            <tbody>{po.items.map((i) => <tr key={i.id} className="border-b last:border-0"><td className="px-4 py-2">{i.variety.name}</td><td className="px-4 py-2">{label(i.grade)}</td><td className="px-4 py-2 text-end tabular">{formatKg(i.quantityKg)}</td><td className="px-4 py-2 text-end tabular">{formatKg(i.receivedKg)}</td><td className="px-4 py-2 text-end tabular">{formatMoney(i.unitCostKg)}</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Goods receipts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {po.receipts.length === 0 && <p className="text-xs text-muted-foreground">Nothing received yet.</p>}
          {po.receipts.map((r) => (
            <div key={r.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">{r.receiptNo} · {formatDate(r.receivedAt)}</div>
              <ul className="mt-1 text-xs">{r.batches.map((b) => <li key={b.id}><Link className="font-mono text-primary hover:underline" href={`/inventory/${b.id}`}>{b.batchNo}</Link> — {b.variety.name}, {formatKg(b.receivedKg)} → {b.coldRoom?.code}</li>)}</ul>
            </div>
          ))}
          {po.invoices.length > 0 && <div className="text-xs">Supplier bills: {po.invoices.map((i) => <Link key={i.id} className="me-2 text-primary hover:underline" href={`/invoices/${i.id}`}>{i.invoiceNo}</Link>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
