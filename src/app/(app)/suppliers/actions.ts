"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { BusinessError } from "@/lib/errors";
import { purchaseOrderSchema, supplierSchema, GRADES } from "@/lib/schemas";
import { addDays, parseDateOnly } from "@/lib/dates";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { D } from "@/lib/money";
import { receiveBatch } from "@/lib/services/inventory";
import { createInvoice } from "@/lib/services/finance";

export async function saveSupplierAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("suppliers:write");
    const v = supplierSchema.parse(values);
    if (id) {
      await prisma.supplier.update({ where: { id }, data: v });
      await audit({ userId: user.id, action: "supplier.update", entity: "Supplier", entityId: id, summary: `Updated ${v.name}` });
      revalidatePath(`/suppliers/${id}`);
      return { id };
    }
    const s = await prisma.$transaction(async (tx) => tx.supplier.create({ data: { ...v, code: await nextNumber(tx, "SUP", { year: false, pad: 4 }) } }));
    await audit({ userId: user.id, action: "supplier.create", entity: "Supplier", entityId: s.id, summary: `Created supplier ${s.name}` });
    return { id: s.id };
  }, "Supplier saved");
}

export async function archiveSupplierAction(id: string, archive: boolean) {
  return runAction(async () => {
    const user = await assertPermission("suppliers:write");
    await prisma.supplier.update({ where: { id }, data: { archivedAt: archive ? new Date() : null } });
    await audit({ userId: user.id, action: archive ? "supplier.archive" : "supplier.restore", entity: "Supplier", entityId: id });
    revalidatePath("/suppliers");
  }, archive ? "Supplier archived" : "Supplier restored");
}

export async function createPurchaseOrderAction(values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("suppliers:write");
    const v = purchaseOrderSchema.parse(values);
    const po = await prisma.$transaction(async (tx) =>
      tx.purchaseOrder.create({
        data: {
          poNo: await nextNumber(tx, "PO"), supplierId: v.supplierId, status: "SENT", orderDate: parseDateOnly(v.orderDate), expectedDate: v.expectedDate ? parseDateOnly(v.expectedDate) : null, currency: v.currency, notes: v.notes,
          items: { create: v.items.map((i) => ({ varietyId: i.varietyId, grade: i.grade, quantityKg: D(i.quantityKg).toFixed(3), unitCostKg: D(i.unitCostKg).toFixed(4) })) },
        },
      }),
    );
    await audit({ userId: user.id, action: "po.create", entity: "PurchaseOrder", entityId: po.id, summary: `Created ${po.poNo}` });
    return { id: po.id };
  }, "Purchase order created");
}

const receiptSchema = z.object({
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
  createInvoice: z.boolean().default(true),
  lines: z.array(z.object({
    poItemId: z.string(),
    quantityKg: z.coerce.number().min(0),
    cartons: z.coerce.number().int().min(0).default(0),
    coldRoomId: z.string().min(1, "Choose a cold room"),
    expiryDate: z.string().optional(),
    packagingType: z.string().max(120).optional(),
    grade: z.enum(GRADES),
  })),
});

/** Validated goods receipt: inventory is created only inside this transaction, after all lines pass validation. */
export async function receiveGoodsAction(poId: string, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("suppliers:write");
    await assertPermission("inventory:write");
    const v = receiptSchema.parse(values);
    const lines = v.lines.filter((l) => l.quantityKg > 0);
    if (!lines.length) throw new BusinessError("Enter a received quantity for at least one line");
    const grn = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${poId} FOR UPDATE`;
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { items: { include: { variety: true } }, supplier: true } });
      if (po.status === "CANCELLED" || po.status === "RECEIVED") throw new BusinessError(`Purchase order is ${po.status.toLowerCase()}`);
      const receivedAt = parseDateOnly(v.receivedAt);
      const receipt = await tx.goodsReceipt.create({ data: { receiptNo: await nextNumber(tx, "GRN"), poId, supplierId: po.supplierId, receivedAt, notes: v.notes, createdById: user.id } });
      const invLines = [];
      for (const l of lines) {
        const item = po.items.find((i) => i.id === l.poItemId);
        if (!item) throw new BusinessError("Line not on this purchase order");
        const outstanding = D(item.quantityKg).minus(D(item.receivedKg));
        // Allow up to 5% over-delivery tolerance
        if (D(l.quantityKg).gt(outstanding.mul(1.05))) throw new BusinessError(`${item.variety.name}: received ${l.quantityKg} kg exceeds outstanding ${outstanding.toFixed(1)} kg (+5% tolerance)`);
        await receiveBatch(tx, {
          varietyId: item.varietyId, grade: l.grade, origin: po.supplier.country, supplierId: po.supplierId, goodsReceiptId: receipt.id, arrivalDate: receivedAt,
          expiryDate: l.expiryDate ? parseDateOnly(l.expiryDate) : addDays(receivedAt, item.variety.shelfLifeDays), quantityKg: l.quantityKg, cartons: l.cartons,
          packagingType: l.packagingType || null, costPerKg: item.unitCostKg.toString(), coldRoomId: l.coldRoomId, reference: receipt.receiptNo,
        }, user.id);
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedKg: D(item.receivedKg).plus(l.quantityKg).toFixed(3) } });
        invLines.push({ description: `${item.variety.name} ${l.grade.replace("_", " ")} — ${receipt.receiptNo}`, quantity: l.quantityKg, unitPrice: item.unitCostKg.toString() });
      }
      const items = await tx.purchaseOrderItem.findMany({ where: { poId } });
      const done = items.every((i) => D(i.receivedKg).gte(D(i.quantityKg)));
      await tx.purchaseOrder.update({ where: { id: poId }, data: { status: done ? "RECEIVED" : "PARTIALLY_RECEIVED" } });
      if (v.createInvoice) {
        await createInvoice(tx, { type: "PURCHASE", supplierId: po.supplierId, purchaseOrderId: po.id, issueDate: receivedAt, dueDate: addDays(receivedAt, po.supplier.paymentTermsDays), currency: po.currency, items: invLines, notes: `Supplier bill for ${receipt.receiptNo} (${po.poNo})`, issue: true }, user.id);
      }
      await audit({ userId: user.id, action: "po.receive", entity: "PurchaseOrder", entityId: poId, summary: `${receipt.receiptNo}: ${lines.length} line(s) received` }, tx);
      return receipt;
    });
    revalidatePath(`/suppliers/purchase-orders/${poId}`);
    revalidatePath("/inventory");
    return { id: grn.id };
  }, "Goods received into inventory");
}

export async function cancelPurchaseOrderAction(poId: string, reason?: string) {
  return runAction(async () => {
    const user = await assertPermission("suppliers:write");
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { items: true } });
    if (po.items.some((i) => D(i.receivedKg).gt(0))) throw new BusinessError("Goods were already received against this PO");
    await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: "CANCELLED", notes: `${po.notes ?? ""}\nCancelled: ${reason ?? ""}`.trim() } });
    await audit({ userId: user.id, action: "po.cancel", entity: "PurchaseOrder", entityId: poId, summary: reason });
  }, "Purchase order cancelled");
}
