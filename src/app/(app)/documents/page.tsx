import type { Prisma } from "@prisma/client";
import { Download, Eye, FileText, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/data/filter-bar";
import { UploadDocument } from "@/components/data/upload-document";
import { ActionButton } from "@/components/forms/action-button";
import { listParams, str, type SP } from "@/lib/list-params";
import { DOC_CATEGORIES } from "@/lib/schemas";
import { accessFilter } from "@/lib/services/documents";
import { formatDate } from "@/lib/dates";
import { archiveDocumentAction } from "./actions";
import Link from "next/link";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("documents:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["createdAt", "name"], "createdAt");
  const where: Prisma.DocumentWhereInput = {
    archivedAt: null,
    access: { in: accessFilter(user) },
    ...(can(user, "finance:read") || can(user, "expenses:read") ? {} : { invoiceId: null, expenseId: null }),
    ...(lp.q ? { OR: [{ name: { contains: lp.q, mode: "insensitive" } }, { description: { contains: lp.q, mode: "insensitive" } }, { customer: { companyName: { contains: lp.q, mode: "insensitive" } } }, { shipment: { shipmentNo: { contains: lp.q, mode: "insensitive" } } }] } : {}),
    ...(str(sp, "category") ? { category: str(sp, "category") } : {}),
    ...(str(sp, "link") === "customer" ? { customerId: { not: null } } : str(sp, "link") === "shipment" ? { shipmentId: { not: null } } : str(sp, "link") === "invoice" ? { invoiceId: { not: null } } : {}),
  };
  const [docs, total, customers, shipments, invoices] = await Promise.all([
    prisma.document.findMany({ where, include: { uploadedBy: true, customer: true, shipment: true, invoice: true, supplier: true, expense: true, batch: true }, orderBy: { createdAt: "desc" }, skip: lp.skip, take: lp.take }),
    prisma.document.count({ where }),
    prisma.customer.findMany({ where: { archivedAt: null }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    prisma.shipment.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, shipmentNo: true } }),
    can(user, "finance:read") ? prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, invoiceNo: true } }) : [],
  ]);
  const write = can(user, "documents:write");
  return (
    <div>
      <PageHeader title="Document library" description={<span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Files are stored outside the web root, type-checked by signature and served only to authorized roles.</span>}
        actions={write && <UploadDocument owners={[{ name: "customerId", label: "Customer", options: customers.map((c) => ({ value: c.id, label: c.companyName })) }, { name: "shipmentId", label: "Shipment", options: shipments.map((s) => ({ value: s.id, label: s.shipmentNo })) }, ...(invoices.length ? [{ name: "invoiceId", label: "Invoice", options: invoices.map((i) => ({ value: i.id, label: i.invoiceNo })) }] : [])]} />} />
      <FilterBar placeholder="File name, customer, shipment…" filters={[{ key: "category", label: "Category", options: DOC_CATEGORIES.map((c) => ({ value: c, label: c })) }, { key: "link", label: "Linked to", options: [{ value: "customer", label: "Customers" }, { value: "shipment", label: "Shipments" }, { value: "invoice", label: "Invoices" }] }]} />
      <Card>
        <CardContent className="p-0">
          {docs.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">No documents. Upload commercial invoices, packing lists, bills of lading, certificates of origin and phytosanitary certificates here or from a shipment.</div> : (
            <ul className="divide-y">
              {docs.map((d) => {
                const link = d.shipment ? { href: `/shipments/${d.shipment.id}`, label: d.shipment.shipmentNo } : d.customer ? { href: `/customers/${d.customer.id}`, label: d.customer.companyName } : d.invoice ? { href: `/invoices/${d.invoice.id}`, label: d.invoice.invoiceNo } : d.supplier ? { href: `/suppliers/${d.supplier.id}`, label: d.supplier.name } : d.expense ? { href: `/expenses/${d.expense.id}`, label: d.expense.expenseNo } : d.batch ? { href: `/inventory/${d.batch.id}`, label: d.batch.batchNo } : null;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{d.name}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="muted">{d.category}</Badge>{d.access !== "ALL_STAFF" && <Badge variant="warning">{d.access.toLowerCase()} only</Badge>}<span>{(d.sizeBytes / 1024).toFixed(0)} KB · {formatDate(d.createdAt)} · {d.uploadedBy?.name}</span>{link && <Link href={link.href} className="text-primary hover:underline">{link.label}</Link>}</div>
                    </div>
                    {["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"].includes(d.mimeType) && <a className="rounded p-1.5 hover:bg-muted" title="Preview" href={`/api/documents/${d.id}?inline=1`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>}
                    <a className="rounded p-1.5 hover:bg-muted" title="Download" href={`/api/documents/${d.id}`}><Download className="h-4 w-4" /></a>
                    {write && <ActionButton variant="ghost" action={archiveDocumentAction.bind(null, d.id)} confirmTitle="Archive document?">Archive</ActionButton>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">{total} document(s). Storing a document does not certify its legal validity — trade documents require review by authorized personnel.</p>
    </div>
  );
}
