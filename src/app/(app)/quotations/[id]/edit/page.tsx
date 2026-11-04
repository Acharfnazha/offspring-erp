import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { isoDate } from "@/lib/dates";
import { QuotationForm } from "../../quotation-form";
import { quotationFormData } from "../../form-data";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("quotations:write");
  const { id } = await params;
  const q = await prisma.quotation.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!q) notFound();
  const { customers, varieties, fill } = await quotationFormData();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Revise ${q.quoteNo}`} crumbs={[{ label: "Quotations", href: "/quotations" }, { label: q.quoteNo, href: `/quotations/${q.id}` }, { label: "Revise" }]} description={`Saving creates revision ${q.revision + 1}; revision ${q.revision} stays in history.`} />
      <QuotationForm id={q.id} revising customers={customers} varieties={varieties} fill={fill}
        defaults={{ customerId: q.customerId, issueDate: isoDate(q.issueDate), validUntil: isoDate(q.validUntil), currency: q.currency, incoterm: q.incoterm, paymentTerms: q.paymentTerms ?? "", deliveryTerms: q.deliveryTerms ?? "", portOfLoading: q.portOfLoading ?? "", portOfDischarge: q.portOfDischarge ?? "", shipmentDetails: q.shipmentDetails ?? "", notes: q.notes ?? "", revisionReason: "",
          items: q.items.map((i) => ({ varietyId: i.varietyId ?? "", description: i.description, grade: i.grade, origin: i.origin, packaging: i.packaging ?? "", quantityKg: i.quantityKg.toString(), unitPrice: i.unitPrice.toString(), discountPct: i.discountPct.toString() })) }} />
    </div>
  );
}
