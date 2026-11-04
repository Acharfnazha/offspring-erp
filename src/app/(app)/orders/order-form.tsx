import { DocumentForm } from "@/components/forms/document-form";
import { GRADES, INCOTERMS, opts } from "@/lib/schemas";
import { saveOrderAction } from "./actions";

export function OrderForm({ id, customers, varieties, fill, defaults }: { id: string | null; customers: { value: string; label: string }[]; varieties: { value: string; label: string }[]; fill: Record<string, Record<string, string>>; defaults: Record<string, unknown> }) {
  return (
    <DocumentForm
      schema="order" action={saveOrderAction.bind(null, id)} redirectTo="/orders/:id" submitLabel="Save draft order" headerDiscountKey="headerDiscount"
      defaultValues={defaults}
      newLine={{ varietyId: varieties[0]?.value ?? "", grade: "CLASS_I", description: "", packaging: "", quantityKg: "", unitPrice: "", discountPct: 0 }}
      header={[
        { name: "customerId", label: "Customer", type: "select", options: customers, span: 2 },
        { name: "orderDate", label: "Order date", type: "date" },
        { name: "expectedShipmentDate", label: "Expected shipment", type: "date" },
        { name: "currency", label: "Currency" },
        { name: "exchangeRate", label: "Rate (units per USD)", type: "number", help: "1 for USD orders" },
        { name: "incoterm", label: "Incoterm", type: "select", options: INCOTERMS.map((i) => ({ value: i, label: i })), help: "Freight/insurance are not assumed included" },
        { name: "headerDiscount", label: "Order discount (amount)", type: "number" },
        { name: "paymentTerms", label: "Payment terms", span: 2 },
        { name: "deliveryTerms", label: "Delivery terms", span: 2 },
        { name: "notes", label: "Notes", type: "textarea", span: 3 },
      ]}
      lineCols={[
        { name: "varietyId", label: "Variety", type: "select", options: varieties, width: "col-span-2 md:col-span-3", onSelectFill: fill },
        { name: "grade", label: "Grade", type: "select", options: opts(GRADES) },
        { name: "packaging", label: "Packaging", width: "md:col-span-2" },
        { name: "quantityKg", label: "Qty (kg)", type: "number", width: "md:col-span-2" },
        { name: "unitPrice", label: "Price/kg", type: "number", width: "md:col-span-1" },
        { name: "discountPct", label: "Disc %", type: "number", width: "md:col-span-1" },
      ]}
    />
  );
}
