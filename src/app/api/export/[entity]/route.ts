import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { exportResponse, type Cell } from "@/lib/export";
import { batchWhere } from "@/lib/queries/inventory";
import { isoDate, resolveRange } from "@/lib/dates";
import { D } from "@/lib/money";
import * as A from "@/lib/services/analytics";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Exporter = { perm: Permission; run: (sp: Record<string, string>) => Promise<{ headers: string[]; rows: Cell[][] }> };
const ci = (q?: string) => (q ? { contains: q, mode: "insensitive" as const } : undefined);

const EXPORTERS: Record<string, Exporter> = {
  inventory: {
    perm: "inventory:read",
    run: async (sp) => {
      const rows = await prisma.inventoryBatch.findMany({ where: batchWhere(sp), include: { variety: { include: { product: true } }, coldRoom: true, supplier: true }, orderBy: { arrivalDate: "asc" }, take: 20000 });
      return {
        headers: ["Batch", "Product", "Variety", "Grade", "Origin", "Supplier", "Harvest", "Arrival", "Best before", "Received kg", "On hand kg", "Reserved kg", "Available kg", "Cartons", "Packaging", "Cost/kg USD", "Stock value USD", "Room", "Status"],
        rows: rows.map((b) => [b.batchNo, b.variety.product.name, b.variety.name, b.grade === "CUSTOM" ? b.customGrade : b.grade, b.origin, b.supplier?.name, isoDate(b.harvestDate), isoDate(b.arrivalDate), isoDate(b.expiryDate), Number(b.receivedKg), Number(b.onHandKg), Number(b.reservedKg), Number(D(b.onHandKg).minus(D(b.reservedKg))), b.cartons, b.packagingType, Number(b.costPerKg), Number(D(b.onHandKg).mul(D(b.costPerKg)).toFixed(2)), b.coldRoom?.code, b.status]),
      };
    },
  },
  movements: {
    perm: "inventory:read",
    run: async (sp) => {
      const r = resolveRange(sp.range ?? "year", sp.from, sp.to);
      const rows = await prisma.inventoryMovement.findMany({ where: { createdAt: { gte: r.from, lt: r.toExclusive } }, include: { batch: { include: { variety: true } }, user: true }, orderBy: { createdAt: "asc" }, take: 50000 });
      return { headers: ["Timestamp", "Batch", "Variety", "Type", "Quantity kg", "On hand after", "Reserved after", "Reference", "Notes", "User"], rows: rows.map((m) => [m.createdAt.toISOString(), m.batch.batchNo, m.batch.variety.name, m.type, Number(m.quantityKg), Number(m.onHandAfterKg), Number(m.reservedAfterKg), m.reference, m.notes, m.user?.name]) };
    },
  },
  customers: {
    perm: "customers:read",
    run: async (sp) => {
      const rows = await prisma.customer.findMany({ where: { archivedAt: sp.archived ? { not: null } : null, ...(sp.q ? { OR: [{ companyName: ci(sp.q) }, { country: ci(sp.q) }, { city: ci(sp.q) }, { contactPerson: ci(sp.q) }] } : {}), ...(sp.type ? { type: sp.type as never } : {}), ...(sp.stage ? { pipelineStage: sp.stage as never } : {}) }, orderBy: { companyName: "asc" } });
      return { headers: ["Code", "Company", "Type", "Country", "City", "Contact", "Email", "WhatsApp", "Phone", "Currency", "Terms (days)", "Credit limit", "Stage"], rows: rows.map((c) => [c.code, c.companyName, c.type, c.country, c.city, c.contactPerson, c.email, c.whatsapp, c.phone, c.currency, c.paymentTermsDays, Number(c.creditLimit), c.pipelineStage]) };
    },
  },
  suppliers: {
    perm: "suppliers:read",
    run: async (sp) => {
      const rows = await prisma.supplier.findMany({ where: { archivedAt: null, ...(sp.q ? { OR: [{ name: ci(sp.q) }, { city: ci(sp.q) }] } : {}) }, orderBy: { name: "asc" } });
      return { headers: ["Code", "Name", "Contact", "Email", "Phone", "Country", "City", "Products", "Rating"], rows: rows.map((s) => [s.code, s.name, s.contactPerson, s.email, s.phone, s.country, s.city, s.productsSupplied, s.qualityRating]) };
    },
  },
  orders: {
    perm: "sales:read",
    run: async (sp) => {
      const rows = await prisma.salesOrder.findMany({ where: { ...(sp.status ? { status: sp.status as never } : {}), ...(sp.q ? { OR: [{ orderNo: ci(sp.q) }, { customer: { companyName: ci(sp.q) } }] } : {}) }, include: { customer: true, items: true }, orderBy: { orderDate: "desc" } });
      return { headers: ["Order", "Date", "Customer", "Country", "Incoterm", "Currency", "Total", "Ordered kg", "Dispatched kg", "Status"], rows: rows.map((o) => [o.orderNo, isoDate(o.orderDate), o.customer.companyName, o.customer.country, o.incoterm, o.currency, Number(o.total), o.items.reduce((a, i) => a + Number(i.quantityKg), 0), o.items.reduce((a, i) => a + Number(i.fulfilledKg), 0), o.status]) };
    },
  },
  invoices: {
    perm: "finance:read",
    run: async (sp) => {
      const rows = await prisma.invoice.findMany({ where: { ...(sp.type ? { type: sp.type as never } : {}), ...(sp.status === "open" ? { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } : sp.status ? { status: sp.status as never } : {}), ...(sp.q ? { OR: [{ invoiceNo: ci(sp.q) }, { customer: { companyName: ci(sp.q) } }, { supplier: { name: ci(sp.q) } }] } : {}) }, include: { customer: true, supplier: true }, orderBy: { issueDate: "desc" } });
      return { headers: ["Invoice", "Type", "Party", "Issue date", "Due date", "Currency", "Subtotal", "Discount", "Tax", "Total", "Paid", "Balance", "Status"], rows: rows.map((i) => [i.invoiceNo, i.type, i.customer?.companyName ?? i.supplier?.name, isoDate(i.issueDate), isoDate(i.dueDate), i.currency, Number(i.subtotal), Number(i.discountTotal), Number(i.taxTotal), Number(i.total), Number(i.amountPaid), Number(D(i.total).minus(D(i.amountPaid))), i.status]) };
    },
  },
  payments: {
    perm: "finance:read",
    run: async (sp) => {
      const rows = await prisma.payment.findMany({ where: { ...(sp.direction ? { direction: sp.direction as never } : {}), ...(sp.q ? { OR: [{ paymentNo: ci(sp.q) }, { reference: ci(sp.q) }, { customer: { companyName: ci(sp.q) } }, { supplier: { name: ci(sp.q) } }] } : {}) }, include: { customer: true, supplier: true, allocations: { include: { invoice: true } } }, orderBy: { paidAt: "desc" } });
      return { headers: ["Payment", "Direction", "Party", "Date", "Method", "Reference", "Currency", "Amount", "Allocated", "Unallocated", "Invoices", "Voided"], rows: rows.map((p) => { const alloc = p.allocations.reduce((a, x) => a.plus(x.amount), D(0)); return [p.paymentNo, p.direction, p.customer?.companyName ?? p.supplier?.name, isoDate(p.paidAt), p.method, p.reference, p.currency, Number(p.amount), Number(alloc), Number(D(p.amount).minus(alloc)), p.allocations.map((a) => a.invoice.invoiceNo).join(" "), p.voidedAt ? "yes" : ""]; }) };
    },
  },
  expenses: {
    perm: "expenses:read",
    run: async (sp) => {
      const rows = await prisma.expense.findMany({ where: { archivedAt: null, ...(sp.category ? { category: sp.category as never } : {}), ...(sp.status ? { status: sp.status as never } : {}), ...(sp.from || sp.to ? { date: { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to) } : {}) } } : {}), ...(sp.q ? { OR: [{ description: ci(sp.q) }, { vendor: ci(sp.q) }, { expenseNo: ci(sp.q) }] } : {}) }, orderBy: { date: "desc" } });
      return { headers: ["Expense", "Date", "Category", "Description", "Vendor", "Currency", "Amount", "Status"], rows: rows.map((e) => [e.expenseNo, isoDate(e.date), e.category, e.description, e.vendor, e.currency, Number(e.amount), e.status]) };
    },
  },
  shipments: {
    perm: "shipments:read",
    run: async (sp) => {
      const rows = await prisma.shipment.findMany({ where: { ...(sp.status ? { status: sp.status as never } : {}), ...(sp.q ? { OR: [{ shipmentNo: ci(sp.q) }, { containerNo: ci(sp.q) }, { customer: { companyName: ci(sp.q) } }, { destination: ci(sp.q) }] } : {}) }, include: { customer: true }, orderBy: { createdAt: "desc" } });
      return { headers: ["Shipment", "Customer", "Container", "Type", "Line", "POL", "POD", "ETD", "ATD", "ETA", "ATA", "Net kg", "Cartons", "Freight", "Insurance", "Docs", "Customs", "Status"], rows: rows.map((s) => [s.shipmentNo, s.customer.companyName, s.containerNo, s.containerType, s.shippingLine, s.portOfLoading, s.portOfDischarge, isoDate(s.etd), isoDate(s.atd), isoDate(s.eta), isoDate(s.ata), Number(s.netWeightKg ?? 0), s.cartons, Number(s.freightCost), Number(s.insuranceCost), Number(s.documentationCost), Number(s.customsCost), s.status]) };
    },
  },
  "storage-contracts": {
    perm: "storage:read",
    run: async () => {
      const rows = await prisma.storageContract.findMany({ include: { customer: true, coldRoom: true, movements: true }, orderBy: { entryDate: "desc" } });
      return { headers: ["Contract", "Customer", "Product", "Room", "Entry", "Exit", "Rate/kg/month", "Stored kg (current)", "Status"], rows: rows.map((c) => [c.contractNo, c.customer.companyName, c.productDescription, c.coldRoom.code, isoDate(c.entryDate), isoDate(c.exitDate), Number(c.ratePerKgMonth), c.movements.reduce((a, m) => a + (m.type === "IN" ? 1 : -1) * Number(m.quantityKg), 0), c.status]) };
    },
  },
  "report-monthly": {
    perm: "analytics:finance",
    run: async () => {
      const s = await A.monthlySeries(12);
      return { headers: ["Month", "Revenue", "COGS", "Total expenses", "Profit", "Collected"], rows: s.map((m) => [m.month, m.revenue, m.cogs, m.expenses, m.profit, m.collected]) };
    },
  },
  "report-customers": {
    perm: "analytics:finance",
    run: async (sp) => {
      const r = resolveRange(sp.range ?? "year", sp.from, sp.to);
      const s = await A.profitByCustomer(r.from, r.toExclusive);
      return { headers: ["Customer", "Country", "Dispatched kg", "Revenue USD", "COGS USD", "Gross profit USD", "Margin %"], rows: s.map((x) => [x.name, x.country, x.kg, x.revenue, x.cogs, x.profit, x.marginPct]) };
    },
  },
  "report-products": {
    perm: "analytics:finance",
    run: async (sp) => {
      const r = resolveRange(sp.range ?? "year", sp.from, sp.to);
      const s = await A.salesByProduct(r.from, r.toExclusive);
      return { headers: ["Variety", "Product", "Dispatched kg", "Revenue USD", "COGS USD", "Gross profit USD"], rows: s.map((x) => [x.name, x.product, x.kg, x.value, x.cogs, x.profit]) };
    },
  },
  "report-countries": {
    perm: "analytics:finance",
    run: async (sp) => {
      const r = resolveRange(sp.range ?? "year", sp.from, sp.to);
      const s = await A.profitByCountry(r.from, r.toExclusive);
      return { headers: ["Country", "Dispatched kg", "Revenue USD", "COGS USD", "Gross profit USD", "Margin %"], rows: s.map((x) => [x.name, x.kg, x.revenue, x.cogs, x.profit, x.marginPct]) };
    },
  },
  "report-aging": {
    perm: "analytics:finance",
    run: async () => {
      const a = await A.receivablesAging();
      return { headers: ["Customer", "Current", "1-30", "31-60", "61-90", "90+", "Total"], rows: a.rows.map((r) => [r.name, Number(r.current), Number(r.d1_30), Number(r.d31_60), Number(r.d61_90), Number(r.d90p), Number(r.total)]) };
    },
  },
};

export async function GET(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { entity } = await params;
  const ex = EXPORTERS[entity];
  if (!ex) return new Response("Unknown export", { status: 404 });
  if (!hasPermission(user.role, ex.perm)) return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const { headers, rows } = await ex.run(sp);
  await audit({ userId: user.id, action: "export", entity, summary: `Exported ${rows.length} ${entity} rows (${sp.format ?? "csv"})` });
  return exportResponse(entity, sp.format ?? "csv", headers, rows);
}
