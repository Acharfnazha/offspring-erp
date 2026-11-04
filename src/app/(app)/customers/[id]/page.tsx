import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Mail, MessageCircle, Phone, Globe, FileSpreadsheet, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionButton } from "@/components/forms/action-button";
import { DocumentList } from "@/components/data/document-list";
import { D, formatMoney, sum } from "@/lib/money";
import { formatDate, isoDate } from "@/lib/dates";
import { label } from "@/lib/schemas";
import { archiveCustomerAction, setFollowUpAction } from "../actions";

function MiniTable({ head, rows }: { head: string[]; rows: (React.ReactNode)[][] }) {
  if (!rows.length) return <p className="py-6 text-center text-xs text-muted-foreground">No records.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{head.map((h, i) => <th key={h} className={`px-3 py-2 ${i >= head.length - 2 ? "text-end" : "text-start"}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((c, j) => <td key={j} className={`px-3 py-2 ${j >= r.length - 2 ? "text-end" : ""}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("customers:read");
  const { id } = await params;
  const fin = can(user, "finance:read");
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { orderDate: "desc" }, take: 50 },
      quotations: { orderBy: { issueDate: "desc" }, take: 50 },
      invoices: { where: { status: { not: "CANCELLED" } }, orderBy: { issueDate: "desc" }, take: 100 },
      payments: { where: { voidedAt: null }, orderBy: { paidAt: "desc" }, take: 50, include: { allocations: true } },
      shipments: { orderBy: { createdAt: "desc" }, take: 50 },
      storageContracts: { orderBy: { entryDate: "desc" } },
    },
  });
  if (!c) notFound();
  const write = can(user, "customers:write");
  const sales = sum(c.invoices.filter((i) => ["SALES", "COLD_STORAGE"].includes(i.type) && i.status !== "DRAFT").map((i) => i.total));
  const open = sum(c.invoices.filter((i) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status) && i.type !== "PRO_FORMA").map((i) => D(i.total).minus(D(i.amountPaid))));
  const unallocated = sum(c.payments.map((p) => D(p.amount).minus(sum(p.allocations.map((a) => a.amount)))));
  const util = D(c.creditLimit).gt(0) ? open.div(D(c.creditLimit)).mul(100) : D(0);
  return (
    <div className="space-y-4">
      <PageHeader
        title={c.companyName}
        crumbs={[{ label: "Customers", href: "/customers" }, { label: c.code }]}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={c.pipelineStage} label={label(c.pipelineStage)} />{label(c.type)} · {[c.city, c.country].filter(Boolean).join(", ")}{c.archivedAt && <StatusBadge status="CANCELLED" label="Archived" />}</span>}
        actions={<>
          {fin && <Button variant="outline" asChild><a href={`/api/pdf/statement/${c.id}`} target="_blank"><FileSpreadsheet />Statement</a></Button>}
          {can(user, "quotations:write") && <Button variant="outline" asChild><Link href={`/quotations/new?customer=${c.id}`}><Plus />Quotation</Link></Button>}
          {write && <Button variant="outline" asChild><Link href={`/customers/${c.id}/edit`}><Pencil />Edit</Link></Button>}
          {write && <ActionButton action={archiveCustomerAction.bind(null, c.id, !c.archivedAt)} confirmTitle={c.archivedAt ? "Restore customer?" : "Archive customer?"} confirmText="Archived customers are hidden from lists; their history is retained.">{c.archivedAt ? "Restore" : "Archive"}</ActionButton>}
        </>}
      />
      {fin && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[["Lifetime invoiced", formatMoney(sales)], ["Outstanding balance", formatMoney(open)], ["Credit limit / used", `${formatMoney(c.creditLimit)} · ${util.toFixed(0)}%`], ["Unallocated payments", formatMoney(unallocated)]].map(([l, v]) => (
            <Card key={l} className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div><div className={`mt-1 text-lg font-semibold tabular ${l === "Credit limit / used" && util.gt(100) ? "text-red-600" : ""}`}>{v}</div></Card>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid gap-3">
              <Field label="Contact person">{c.contactPerson}</Field>
              <Field label="Address">{c.address}</Field>
              <Field label="Currency · Terms">{c.currency} · {c.paymentTermsDays} days{c.paymentTerms ? ` — ${c.paymentTerms}` : ""}</Field>
            </dl>
            <div className="flex flex-wrap gap-2">
              {c.email && <Button size="sm" variant="outline" asChild><a href={`mailto:${c.email}`}><Mail />Email</a></Button>}
              {c.whatsapp && <Button size="sm" variant="outline" asChild><a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>}
              {c.phone && <Button size="sm" variant="outline" asChild><a href={`tel:${c.phone}`}><Phone />Call</a></Button>}
              {c.website && <Button size="sm" variant="outline" asChild><a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer"><Globe />Web</a></Button>}
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Next follow-up</div>
              <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                <span>{formatDate(c.nextFollowUpAt)}</span>
                {write && <ActionButton action={setFollowUpAction.bind(null, c.id)} confirmTitle="Set follow-up reminder" inputLabel="Follow-up date" inputType="date">Set reminder</ActionButton>}
              </div>
            </div>
            {c.notes && <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{c.notes}</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <Tabs defaultValue="orders">
              <TabsList>
                <TabsTrigger value="orders">Orders ({c.orders.length})</TabsTrigger>
                <TabsTrigger value="quotes">Quotations ({c.quotations.length})</TabsTrigger>
                {fin && <TabsTrigger value="invoices">Invoices ({c.invoices.length})</TabsTrigger>}
                {fin && <TabsTrigger value="payments">Payments ({c.payments.length})</TabsTrigger>}
                <TabsTrigger value="shipments">Shipments ({c.shipments.length})</TabsTrigger>
                <TabsTrigger value="storage">Storage ({c.storageContracts.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="orders"><MiniTable head={["Order", "Date", "Status", "Total"]} rows={c.orders.map((o) => [<Link key="l" className="text-primary hover:underline" href={`/orders/${o.id}`}>{o.orderNo}</Link>, formatDate(o.orderDate), <StatusBadge key="s" status={o.status} />, formatMoney(o.total, o.currency)])} /></TabsContent>
              <TabsContent value="quotes"><MiniTable head={["Quotation", "Valid until", "Status", "Total"]} rows={c.quotations.map((q) => [<Link key="l" className="text-primary hover:underline" href={`/quotations/${q.id}`}>{q.quoteNo} r{q.revision}</Link>, formatDate(q.validUntil), <StatusBadge key="s" status={q.status} />, formatMoney(q.total, q.currency)])} /></TabsContent>
              {fin && <TabsContent value="invoices"><MiniTable head={["Invoice", "Type", "Due", "Status", "Balance"]} rows={c.invoices.map((i) => [<Link key="l" className="text-primary hover:underline" href={`/invoices/${i.id}`}>{i.invoiceNo}</Link>, label(i.type), formatDate(i.dueDate), <StatusBadge key="s" status={i.status} />, formatMoney(D(i.total).minus(D(i.amountPaid)), i.currency)])} /></TabsContent>}
              {fin && <TabsContent value="payments"><MiniTable head={["Receipt", "Date", "Method", "Amount"]} rows={c.payments.map((p) => [<Link key="l" className="text-primary hover:underline" href={`/payments/${p.id}`}>{p.paymentNo}</Link>, formatDate(p.paidAt), label(p.method), formatMoney(p.amount, p.currency)])} /></TabsContent>}
              <TabsContent value="shipments"><MiniTable head={["Shipment", "Container", "ETA", "Status"]} rows={c.shipments.map((s) => [<Link key="l" className="text-primary hover:underline" href={`/shipments/${s.id}`}>{s.shipmentNo}</Link>, s.containerNo ?? "—", isoDate(s.eta) || "—", <StatusBadge key="s" status={s.status} />])} /></TabsContent>
              <TabsContent value="storage"><MiniTable head={["Contract", "Product", "Entry", "Status"]} rows={c.storageContracts.map((s) => [<Link key="l" className="text-primary hover:underline" href={`/cold-storage/contracts/${s.id}`}>{s.contractNo}</Link>, s.productDescription, formatDate(s.entryDate), <StatusBadge key="s" status={s.status} />])} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <DocumentList owner={{ customerId: c.id }} />
    </div>
  );
}
