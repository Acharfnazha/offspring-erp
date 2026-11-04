import { z } from "zod";

// Shared between client forms (React Hook Form) and server actions (authoritative validation).
const optStr = (max = 500) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));
const reqStr = (max = 200) => z.string().trim().min(1, "Required").max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const optDate = z.union([date, z.literal(""), z.undefined(), z.null()]).transform((v) => (v ? v : null));
const dec = (min = 0) => z.coerce.number({ invalid_type_error: "Enter a number" }).finite().min(min, `Must be ≥ ${min}`);
const pos = z.coerce.number({ invalid_type_error: "Enter a number" }).finite().positive("Must be greater than 0");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter ISO code");
const email = z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const GRADES = ["EXTRA", "CLASS_I", "CLASS_II", "CUSTOM"] as const;
export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DDP"] as const;
export const CUSTOMER_TYPES = ["IMPORTER", "WHOLESALER", "SUPERMARKET", "DISTRIBUTOR", "EXPORT_PARTNER", "COLD_STORAGE_CUSTOMER"] as const;
export const PIPELINE = ["NEW_LEAD", "CONTACTED", "NEGOTIATION", "QUOTATION_SENT", "ORDER_CONFIRMED", "SHIPMENT_PREPARATION", "SHIPPED", "DELIVERED", "PAID", "CLOSED"] as const;
export const EXPENSE_CATEGORIES = ["FRUIT_PURCHASES", "PACKAGING", "TRANSPORTATION", "FUEL", "ELECTRICITY", "REFRIGERATION", "MAINTENANCE", "LABOR", "SALARIES", "CUSTOMS", "FREIGHT", "INSURANCE", "ADMINISTRATIVE", "OTHER"] as const;
export const SHIPMENT_STATUSES = ["PLANNING", "PACKING", "READY_FOR_DISPATCH", "IN_TRANSIT", "ARRIVED", "DELIVERED", "COMPLETED", "CANCELLED"] as const;
export const ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "WAREHOUSE_MANAGER", "SALES_MANAGER", "LOGISTICS_MANAGER", "EMPLOYEE", "VIEWER"] as const;
export const DOC_CATEGORIES = ["Commercial invoice", "Packing list", "Bill of lading", "Air waybill", "Certificate of origin", "Phytosanitary certificate", "Contract", "Receipt", "Quality report", "Other"] as const;

export const customerSchema = z.object({
  companyName: reqStr(),
  country: reqStr(80),
  city: optStr(80),
  address: optStr(300),
  contactPerson: optStr(120),
  email,
  whatsapp: optStr(40),
  phone: optStr(40),
  website: optStr(200),
  currency: currency.default("USD"),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  paymentTerms: optStr(200),
  type: z.enum(CUSTOMER_TYPES),
  creditLimit: dec(0).default(0),
  pipelineStage: z.enum(PIPELINE).default("NEW_LEAD"),
  nextFollowUpAt: optDate,
  notes: optStr(4000),
});

export const supplierSchema = z.object({
  name: reqStr(),
  contactPerson: optStr(120),
  email,
  phone: optStr(40),
  whatsapp: optStr(40),
  country: reqStr(80).default("Lebanon"),
  city: optStr(80),
  address: optStr(300),
  productsSupplied: optStr(500),
  pricingNotes: optStr(1000),
  qualityNotes: optStr(2000),
  qualityRating: z.coerce.number().int().min(1).max(5).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : Number(v))),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
});

export const batchSchema = z.object({
  varietyId: reqStr(),
  grade: z.enum(GRADES),
  customGrade: optStr(60),
  origin: reqStr(80).default("Lebanon"),
  supplierId: optStr(40),
  harvestDate: optDate,
  arrivalDate: date,
  expiryDate: optDate,
  quantityKg: pos,
  cartons: z.coerce.number().int().min(0).default(0),
  packagingType: optStr(120),
  costPerKg: dec(0),
  coldRoomId: optStr(40),
  notes: optStr(2000),
});

export const batchEditSchema = batchSchema.pick({ grade: true, customGrade: true, origin: true, supplierId: true, harvestDate: true, expiryDate: true, packagingType: true, notes: true, cartons: true }).extend({
  status: z.enum(["AVAILABLE", "QUARANTINE"]).optional(),
});

export const coldRoomSchema = z.object({
  code: reqStr(20),
  name: reqStr(80),
  warehouseId: reqStr(),
  capacityKg: pos,
  targetTempC: z.coerce.number().min(-30).max(30),
  targetHumidity: z.coerce.number().min(0).max(100),
  tempToleranceC: z.coerce.number().min(0).max(10).default(1.5),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "OFFLINE"]),
  maintenanceNotes: optStr(2000),
  sensorId: optStr(80),
});

export const readingSchema = z.object({
  temperatureC: z.coerce.number().min(-40).max(50),
  humidity: z.coerce.number().min(0).max(100).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : Number(v))),
});

export const storageContractSchema = z.object({
  customerId: reqStr(),
  varietyId: optStr(40),
  productDescription: reqStr(200),
  batchReference: optStr(80),
  coldRoomId: reqStr(),
  quantityKg: pos,
  ratePerKgMonth: dec(0).default(0.05),
  minimumPeriods: z.coerce.number().int().min(0).max(12).default(1),
  entryDate: date,
  notes: optStr(2000),
});

export const shipmentSchema = z.object({
  customerId: reqStr(),
  containerNo: optStr(20),
  containerType: optStr(40),
  transportMode: z.enum(["SEA", "AIR", "ROAD"]).default("SEA"),
  shippingLine: optStr(80),
  freightForwarder: optStr(80),
  origin: reqStr(80).default("Lebanon"),
  destination: reqStr(80),
  portOfLoading: optStr(80),
  portOfDischarge: optStr(80),
  etd: optDate,
  atd: optDate,
  eta: optDate,
  ata: optDate,
  grossWeightKg: dec(0).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : Number(v))),
  netWeightKg: dec(0).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : Number(v))),
  cartons: z.coerce.number().int().min(0).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : Number(v))),
  freightCost: dec(0).default(0),
  insuranceCost: dec(0).default(0),
  documentationCost: dec(0).default(0),
  customsCost: dec(0).default(0),
  trackingProvider: optStr(60),
  trackingRef: optStr(80),
  notes: optStr(4000),
});

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: reqStr(300),
  vendor: optStr(120),
  amount: pos,
  currency: currency.default("USD"),
  date,
  shipmentId: optStr(40),
  notes: optStr(2000),
});

export const userSchema = z.object({
  name: reqStr(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES),
  jobTitle: optStr(120),
  phone: optStr(40),
});

export const lineSchema = z.object({
  varietyId: z.string().optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  grade: z.enum(GRADES).default("CLASS_I"),
  origin: z.string().trim().max(80).optional().or(z.literal("")),
  packaging: z.string().trim().max(120).optional().or(z.literal("")),
  quantityKg: pos,
  unitPrice: dec(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
});

export const quotationSchema = z.object({
  customerId: reqStr(),
  issueDate: date,
  validUntil: date,
  currency: currency.default("USD"),
  incoterm: z.enum(INCOTERMS),
  paymentTerms: optStr(300),
  deliveryTerms: optStr(300),
  portOfLoading: optStr(80),
  portOfDischarge: optStr(80),
  shipmentDetails: optStr(1000),
  notes: optStr(4000),
  revisionReason: optStr(300),
  items: z.array(lineSchema).min(1, "Add at least one line"),
});

export const orderSchema = z.object({
  customerId: reqStr(),
  orderDate: date,
  currency: currency.default("USD"),
  exchangeRate: z.coerce.number().positive().default(1),
  incoterm: z.enum(INCOTERMS),
  paymentTerms: optStr(300),
  deliveryTerms: optStr(300),
  expectedShipmentDate: optDate,
  headerDiscount: dec(0).default(0),
  notes: optStr(4000),
  items: z.array(lineSchema.extend({ varietyId: reqStr() })).min(1, "Add at least one line"),
});

export const invoiceLineSchema = z.object({
  description: reqStr(300),
  quantity: pos,
  unit: z.string().trim().min(1).max(20).default("kg"),
  unitPrice: dec(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxPct: z.coerce.number().min(0).max(100).default(0),
});

export const invoiceSchema = z.object({
  type: z.enum(["SALES", "PURCHASE", "COLD_STORAGE", "PRO_FORMA"]),
  customerId: optStr(40),
  supplierId: optStr(40),
  issueDate: date,
  dueDate: date,
  currency: currency.default("USD"),
  exchangeRate: z.coerce.number().positive().default(1),
  headerDiscount: dec(0).default(0),
  notes: optStr(4000),
  items: z.array(invoiceLineSchema).min(1, "Add at least one line"),
});

export const paymentSchema = z.object({
  direction: z.enum(["INCOMING", "OUTGOING"]),
  customerId: optStr(40),
  supplierId: optStr(40),
  method: z.enum(["BANK_TRANSFER", "CASH", "OTHER"]),
  amount: pos,
  currency: currency.default("USD"),
  paidAt: date,
  reference: optStr(120),
  notes: optStr(1000),
  idempotencyKey: z.string().min(8).max(100),
  allocations: z.array(z.object({ invoiceId: z.string().min(1), amount: dec(0) })).default([]),
});

export const purchaseOrderSchema = z.object({
  supplierId: reqStr(),
  orderDate: date,
  expectedDate: optDate,
  currency: currency.default("USD"),
  notes: optStr(2000),
  items: z.array(z.object({ varietyId: reqStr(), grade: z.enum(GRADES), quantityKg: pos, unitCostKg: dec(0) })).min(1),
});

export type FormSchemaName = "quotation" | "order" | "invoice" | "purchaseOrder" | "customer" | "supplier" | "batch" | "batchEdit" | "coldRoom" | "reading" | "storageContract" | "shipment" | "expense" | "user";
export const FORM_SCHEMAS: Record<FormSchemaName, z.ZodTypeAny> = {
  quotation: quotationSchema,
  order: orderSchema,
  invoice: invoiceSchema,
  purchaseOrder: purchaseOrderSchema,
  customer: customerSchema,
  supplier: supplierSchema,
  batch: batchSchema,
  batchEdit: batchEditSchema,
  coldRoom: coldRoomSchema,
  reading: readingSchema,
  storageContract: storageContractSchema,
  shipment: shipmentSchema,
  expense: expenseSchema,
  user: userSchema,
};

export function label(v: string) {
  return v.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase()).replace(/\bIi\b/, "II").replace(/\bI\b/, "I");
}
export const opts = (vals: readonly string[]) => vals.map((v) => ({ value: v, label: label(v) }));
