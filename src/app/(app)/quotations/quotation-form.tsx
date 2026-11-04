import { DocumentForm } from "@/components/forms/document-form";
import { GRADES, INCOTERMS, opts } from "@/lib/schemas";
import { saveQuotationAction } from "./actions";

export function QuotationForm({ id, customers, varieties, fill, defaults, revising }: {
  id: string | null;
  customers: { value: string; label: string }[];
  varieties: { value: string; label: string }[];
  fill: Record<string, Record<string, string>>;
  defaults: Record<string, unknown>;
  revising?: boolean;
}) {
  return (
    <DocumentForm
      schema="quotation"
      action={saveQuotationAction.bind(null, id)}
      redirectTo="/quotations/:id"
      submitLabel={revising ? "Save new revision" : "Save quotation"}
      defaultValues={defaults}
      newLine={{ varietyId: "", description: "", grade: "CLASS_I", origin: "Lebanon", packaging: "", quantityKg: "", unitPrice: "", discountPct: 0 }}
      header={[
        { name: "customerId", label: "Customer", type: "select", options: customers, span: 2 },
        { name: "issueDate", label: "Issue date", type: "date" },
        { name: "validUntil", label: "Valid until", type: "date" },
        { name: "currency", label: "Currency" },
        { name: "incoterm", label: "Incoterm", type: "select", options: opts(INCOTERMS).map((o) => ({ ...o, label: o.value })), help: "Freight/insurance are not assumed included unless the Incoterm says so" },
        { name: "portOfLoading", label: "Port of loading" },
        { name: "portOfDischarge", label: "Port of discharge" },
        { name: "paymentTerms", label: "Payment terms", span: 2 },
        { name: "deliveryTerms", label: "Delivery terms", span: 2 },
        { name: "shipmentDetails", label: "Shipment details", type: "textarea", span: 2 },
        { name: "notes", label: "Notes", type: "textarea", span: 2 },
        ...(revising ? [{ name: "revisionReason", label: "Reason for revision", span: 3 as const }] : []),
      ]}
      lineCols={[
        { name: "varietyId", label: "Variety", type: "select", options: [{ value: "", label: "— Select —" }, ...varieties], width: "col-span-2 md:col-span-3", onSelectFill: fill },
        { name: "description", label: "Description", width: "col-span-2 md:col-span-2" },
        { name: "grade", label: "Grade", type: "select", options: opts(GRADES), width: "md:col-span-1" },
        { name: "packaging", label: "Packaging", width: "md:col-span-1" },
        { name: "quantityKg", label: "Qty (kg)", type: "number", width: "md:col-span-1" },
        { name: "unitPrice", label: "Price/kg", type: "number", width: "md:col-span-1" },
        { name: "discountPct", label: "Disc %", type: "number", width: "md:col-span-1" },
        { name: "origin", label: "Origin", width: "md:col-span-1" },
      ]}
    />
  );
}
