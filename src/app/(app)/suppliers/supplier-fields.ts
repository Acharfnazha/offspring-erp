import type { FieldDef } from "@/components/forms/entity-form";
export const SUPPLIER_FIELDS: FieldDef[] = [
  { name: "name", label: "Supplier name", section: "Supplier" },
  { name: "contactPerson", label: "Contact person" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "whatsapp", label: "WhatsApp", type: "tel" },
  { name: "country", label: "Country" },
  { name: "city", label: "City / region" },
  { name: "address", label: "Address" },
  { name: "productsSupplied", label: "Products supplied", span: 2, section: "Commercial" },
  { name: "paymentTermsDays", label: "Payment terms (days)", type: "number", step: "1" },
  { name: "qualityRating", label: "Quality rating (1–5)", type: "number", step: "1" },
  { name: "pricingNotes", label: "Pricing notes", type: "textarea", span: 2 },
  { name: "qualityNotes", label: "Quality notes", type: "textarea", span: 2 },
];
