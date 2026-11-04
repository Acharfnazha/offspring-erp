import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { D } from "@/lib/money";
import { BusinessError } from "@/lib/errors";
import { computeTotals } from "@/lib/invoice-math";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { parseDateOnly, todayDate } from "@/lib/dates";
import type { z } from "zod";
import type { quotationSchema } from "@/lib/schemas";
import { createOrder } from "./orders";

type QInput = z.output<typeof quotationSchema>;

function build(v: QInput) {
  const totals = computeTotals(v.items.map((i) => ({ quantity: i.quantityKg, unitPrice: i.unitPrice, discountPct: i.discountPct })));
  return {
    header: {
      customerId: v.customerId, issueDate: parseDateOnly(v.issueDate), validUntil: parseDateOnly(v.validUntil), currency: v.currency, incoterm: v.incoterm,
      paymentTerms: v.paymentTerms, deliveryTerms: v.deliveryTerms, portOfLoading: v.portOfLoading, portOfDischarge: v.portOfDischarge, shipmentDetails: v.shipmentDetails, notes: v.notes,
      subtotal: totals.subtotal.toFixed(2), discountTotal: totals.discountTotal.toFixed(2), total: totals.total.toFixed(2),
    },
    items: v.items.map((i, idx) => ({
      varietyId: i.varietyId || null, description: i.description || "Fresh fruit", grade: i.grade, origin: i.origin || "Lebanon", packaging: i.packaging || null,
      quantityKg: D(i.quantityKg).toFixed(3), unitPrice: D(i.unitPrice).toFixed(4), discountPct: D(i.discountPct).toFixed(2), lineTotal: totals.lines[idx].net.toFixed(2), sortOrder: idx,
    })),
  };
}

export async function createQuotation(tx: Tx, v: QInput, userId: string) {
  if (parseDateOnly(v.validUntil) < parseDateOnly(v.issueDate)) throw new BusinessError("Validity date must be after the issue date");
  const { header, items } = build(v);
  const q = await tx.quotation.create({ data: { ...header, quoteNo: await nextNumber(tx, "QT"), createdById: userId, items: { create: items } }, include: { items: true } });
  await tx.quotationRevision.create({ data: { quotationId: q.id, revision: 1, snapshot: JSON.parse(JSON.stringify(q)) as Prisma.InputJsonValue, reason: "Initial version", createdById: userId } });
  await tx.customer.updateMany({ where: { id: v.customerId, pipelineStage: { in: ["NEW_LEAD", "CONTACTED", "NEGOTIATION"] } }, data: { pipelineStage: "QUOTATION_SENT" } });
  await audit({ userId, action: "quotation.create", entity: "Quotation", entityId: q.id, summary: `Created ${q.quoteNo}` }, tx);
  return q;
}

/** Saves a new revision; the previous version is kept as an immutable snapshot. */
export async function reviseQuotation(tx: Tx, id: string, v: QInput, userId: string) {
  const q = await tx.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!q) throw new BusinessError("Quotation not found");
  if (!["DRAFT", "SENT", "REJECTED", "EXPIRED"].includes(q.status)) throw new BusinessError(`A ${q.status.toLowerCase()} quotation cannot be revised`);
  const { header, items } = build(v);
  const rev = q.revision + 1;
  await tx.quotationItem.deleteMany({ where: { quotationId: id } });
  const updated = await tx.quotation.update({ where: { id }, data: { ...header, revision: rev, status: "DRAFT", items: { create: items } }, include: { items: true } });
  await tx.quotationRevision.create({ data: { quotationId: id, revision: rev, snapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue, reason: v.revisionReason || "Revised", createdById: userId } });
  await audit({ userId, action: "quotation.revise", entity: "Quotation", entityId: id, summary: `${q.quoteNo} revision ${rev}` }, tx);
  return updated;
}

export async function convertQuotationToOrder(tx: Tx, id: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM "Quotation" WHERE id = ${id} FOR UPDATE`;
  const q = await tx.quotation.findUnique({ where: { id }, include: { items: true, salesOrder: true } });
  if (!q) throw new BusinessError("Quotation not found");
  if (q.salesOrder) throw new BusinessError(`Already converted to ${q.salesOrder.orderNo}`);
  if (!["SENT", "ACCEPTED", "DRAFT"].includes(q.status)) throw new BusinessError(`A ${q.status.toLowerCase()} quotation cannot be converted`);
  if (q.validUntil < todayDate()) throw new BusinessError("Quotation validity has expired — revise it before converting");
  const missing = q.items.filter((i) => !i.varietyId);
  if (missing.length) throw new BusinessError("Every line needs a product variety before conversion to an order");
  const order = await createOrder(tx, {
    customerId: q.customerId, orderDate: todayDate(), currency: q.currency, incoterm: q.incoterm, paymentTerms: q.paymentTerms, deliveryTerms: q.deliveryTerms,
    notes: [q.shipmentDetails, q.notes].filter(Boolean).join("\n"), quotationId: q.id,
    items: q.items.map((i) => ({ varietyId: i.varietyId!, grade: i.grade, description: i.description, packaging: i.packaging, quantityKg: i.quantityKg.toString(), unitPrice: i.unitPrice.toString(), discountPct: i.discountPct.toString() })),
  }, userId);
  await tx.quotation.update({ where: { id }, data: { status: "CONVERTED" } });
  await audit({ userId, action: "quotation.convert", entity: "Quotation", entityId: id, summary: `${q.quoteNo} → ${order.orderNo}` }, tx);
  return order;
}
