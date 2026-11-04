import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentForm } from "@/components/forms/document-form";
import { customerOptions, supplierOptions } from "@/lib/options";
import { addDays, businessDate, isoDate, todayDate } from "@/lib/dates";
import { str, type SP } from "@/lib/list-params";
import { createInvoiceAction } from "../actions";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("finance:write");
  const sp = await searchParams;
  const [customers, suppliers] = await Promise.all([customerOptions(), supplierOptions()]);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New invoice" crumbs={[{ label: "Invoices", href: "/invoices" }, { label: "New" }]} description="For sales orders use “Create invoice” on the order; storage invoices are generated from storage contracts. Customer is used for sales/pro forma/storage, supplier for purchase invoices." />
      <DocumentForm schema="invoice" action={createInvoiceAction} redirectTo="/invoices/:id" submitLabel="Save as draft" extraSubmit={{ label: "Save & issue", flag: "issueNow" }}
        qtyKey="quantity" priceKey="unitPrice" taxKey="taxPct" headerDiscountKey="headerDiscount"
        defaultValues={{ type: str(sp, "type") ?? "SALES", customerId: customers[0]?.value ?? "", supplierId: suppliers[0]?.value ?? "", issueDate: businessDate(), dueDate: isoDate(addDays(todayDate(), 30)), currency: "USD", exchangeRate: 1, headerDiscount: 0, items: [{ description: "", quantity: "", unit: "kg", unitPrice: "", discountPct: 0, taxPct: 0 }] }}
        newLine={{ description: "", quantity: "", unit: "kg", unitPrice: "", discountPct: 0, taxPct: 0 }}
        header={[
          { name: "type", label: "Invoice type", type: "select", options: [{ value: "SALES", label: "Sales invoice" }, { value: "PRO_FORMA", label: "Pro forma invoice" }, { value: "COLD_STORAGE", label: "Cold-storage invoice" }, { value: "PURCHASE", label: "Purchase invoice (supplier bill)" }] },
          { name: "customerId", label: "Customer", type: "select", options: customers },
          { name: "supplierId", label: "Supplier", type: "select", options: suppliers },
          { name: "currency", label: "Currency" },
          { name: "issueDate", label: "Issue date", type: "date" },
          { name: "dueDate", label: "Due date", type: "date" },
          { name: "exchangeRate", label: "Rate (units per USD)", type: "number" },
          { name: "headerDiscount", label: "Invoice discount (amount)", type: "number" },
          { name: "notes", label: "Notes", type: "textarea", span: 3 },
        ]}
        lineCols={[
          { name: "description", label: "Description", width: "col-span-2 md:col-span-4" },
          { name: "quantity", label: "Qty", type: "number", width: "md:col-span-2" },
          { name: "unit", label: "Unit", width: "md:col-span-1" },
          { name: "unitPrice", label: "Unit price", type: "number", width: "md:col-span-2" },
          { name: "discountPct", label: "Disc %", type: "number", width: "md:col-span-1" },
          { name: "taxPct", label: "Tax %", type: "number", width: "md:col-span-1" },
        ]} />
    </div>
  );
}
