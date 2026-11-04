import type { FieldDef } from "@/components/forms/entity-form";
import { CUSTOMER_TYPES, PIPELINE, opts } from "@/lib/schemas";

export const CUSTOMER_FIELDS: FieldDef[] = [
  { name: "companyName", label: "Company name", section: "Company" },
  { name: "type", label: "Customer type", type: "select", options: opts(CUSTOMER_TYPES) },
  { name: "country", label: "Country" },
  { name: "city", label: "City" },
  { name: "address", label: "Address", span: 2 },
  { name: "website", label: "Website", type: "url" },
  { name: "contactPerson", label: "Contact person", section: "Contact" },
  { name: "email", label: "Email", type: "email" },
  { name: "whatsapp", label: "WhatsApp", type: "tel" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "currency", label: "Currency", section: "Commercial terms", help: "ISO code, e.g. USD, AED, SAR" },
  { name: "paymentTermsDays", label: "Payment terms (days)", type: "number", step: "1" },
  { name: "paymentTerms", label: "Payment terms description", span: 2, placeholder: "e.g. 30% advance, 70% against BL copy" },
  { name: "creditLimit", label: "Credit limit (USD)", type: "number" },
  { name: "pipelineStage", label: "Pipeline stage", type: "select", options: opts(PIPELINE) },
  { name: "nextFollowUpAt", label: "Next follow-up", type: "date" },
  { name: "notes", label: "Notes", type: "textarea", span: 2 },
];
