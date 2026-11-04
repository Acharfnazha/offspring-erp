import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { addDays, businessDate, isoDate, todayDate } from "@/lib/dates";
import { str, type SP } from "@/lib/list-params";
import { QuotationForm } from "../quotation-form";
import { quotationFormData } from "../form-data";

export const metadata = { title: "New quotation" };

export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("quotations:write");
  const sp = await searchParams;
  const { customers, varieties, fill } = await quotationFormData();
  let item: Record<string, unknown> = { varietyId: "", description: "", grade: "EXTRA", origin: "Lebanon", packaging: "", quantityKg: "", unitPrice: "", discountPct: 0 };
  let notes = "";
  const calcId = str(sp, "calc");
  if (calcId) {
    const calc = await prisma.profitCalculation.findFirst({ where: { id: calcId, OR: [{ createdById: user.id }, {}] } });
    if (calc) {
      const i = calc.inputs as Record<string, unknown>;
      const v = await prisma.productVariety.findFirst({ where: { name: String(i.variety ?? "") } });
      item = { ...item, varietyId: v?.id ?? "", description: v ? fill[v.id]?.description : String(i.variety ?? ""), packaging: `${i.cartonWeightKg} kg carton`, quantityKg: i.totalKg, unitPrice: i.sellingPricePerKg };
      notes = `Prepared from profit calculation "${calc.name}".`;
    }
  }
  const customerId = str(sp, "customer") ?? customers[0]?.value ?? "";
  const cust = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }) : null;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New quotation" crumbs={[{ label: "Quotations", href: "/quotations" }, { label: "New" }]} description="Saved as a draft. Preview and download the PDF from the quotation page." />
      <QuotationForm id={null} customers={customers} varieties={varieties} fill={fill}
        defaults={{ customerId, issueDate: businessDate(), validUntil: isoDate(addDays(todayDate(), 14)), currency: cust?.currency ?? "USD", incoterm: "FOB", portOfLoading: "Beirut", paymentTerms: cust?.paymentTerms ?? "", notes, items: [item] }} />
    </div>
  );
}
