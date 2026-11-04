import type { FieldDef } from "@/components/forms/entity-form";
import { EXPENSE_CATEGORIES, opts } from "@/lib/schemas";
export const expenseFields = (shipments: { value: string; label: string }[]): FieldDef[] => [
  { name: "category", label: "Category", type: "select", options: opts(EXPENSE_CATEGORIES) },
  { name: "date", label: "Date", type: "date" },
  { name: "description", label: "Description", span: 2 },
  { name: "vendor", label: "Vendor / payee" },
  { name: "amount", label: "Amount", type: "number", step: "0.01" },
  { name: "currency", label: "Currency" },
  { name: "shipmentId", label: "Related shipment", type: "select", options: [{ value: "", label: "— None —" }, ...shipments] },
  { name: "notes", label: "Notes", type: "textarea", span: 2 },
];
