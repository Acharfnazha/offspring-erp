"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { batchEditSchema, batchSchema } from "@/lib/schemas";
import { parseDateOnly } from "@/lib/dates";
import { adjustBatch, dispatchFromBatch, receiveBatch, recordSpoilage, releaseReservation, reserveBatch, transferBatch } from "@/lib/services/inventory";
import { audit } from "@/lib/audit";

const pd = (s: string | null) => (s ? parseDateOnly(s) : null);
const qty = z.coerce.number().positive("Quantity must be greater than 0");

export async function createBatchAction(values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    const v = batchSchema.parse(values);
    const b = await prisma.$transaction((tx) =>
      receiveBatch(tx, { ...v, harvestDate: pd(v.harvestDate), arrivalDate: parseDateOnly(v.arrivalDate), expiryDate: pd(v.expiryDate) }, user.id),
    );
    revalidatePath("/inventory");
    return { id: b.id };
  }, "Inventory batch received");
}

export async function updateBatchAction(id: string, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    const v = batchEditSchema.parse(values);
    const before = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id } });
    const status = v.status && ["AVAILABLE", "RESERVED", "QUARANTINE"].includes(before.status) ? (v.status === "QUARANTINE" ? "QUARANTINE" : before.reservedKg.gte(before.onHandKg) && before.onHandKg.gt(0) ? "RESERVED" : "AVAILABLE") : before.status;
    const after = await prisma.inventoryBatch.update({
      where: { id },
      data: { grade: v.grade, customGrade: v.grade === "CUSTOM" ? v.customGrade : null, origin: v.origin, supplierId: v.supplierId, harvestDate: pd(v.harvestDate), expiryDate: pd(v.expiryDate), packagingType: v.packagingType, notes: v.notes, cartons: v.cartons, status },
    });
    await audit({ userId: user.id, action: "inventory.update", entity: "InventoryBatch", entityId: id, summary: `Edited ${before.batchNo}`, before, after });
    revalidatePath(`/inventory/${id}`);
    return { id };
  }, "Batch updated");
}

export async function transferAction(batchId: string, toRoomId: string, quantityKg: number, notes?: string) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    const child = await prisma.$transaction((tx) => transferBatch(tx, batchId, toRoomId, qty.parse(quantityKg), user.id, notes));
    revalidatePath("/inventory");
    return { id: child.id };
  }, "Transfer recorded");
}

export async function reserveAction(batchId: string, quantityKg: number, note: string) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    await prisma.$transaction((tx) => reserveBatch(tx, batchId, qty.parse(quantityKg), { note: note || "Manual reservation", userId: user.id }));
    revalidatePath(`/inventory/${batchId}`);
  }, "Stock reserved");
}

export async function releaseAction(reservationId: string, batchId: string) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    await prisma.$transaction((tx) => releaseReservation(tx, reservationId, user.id, "Released manually"));
    revalidatePath(`/inventory/${batchId}`);
  }, "Reservation released");
}

export async function spoilageAction(batchId: string, quantityKg: number, notes: string) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    await prisma.$transaction((tx) => recordSpoilage(tx, batchId, qty.parse(quantityKg), user.id, notes));
    revalidatePath(`/inventory/${batchId}`);
  }, "Spoilage recorded");
}

export async function dispatchAction(batchId: string, quantityKg: number, reference: string) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    await prisma.$transaction((tx) => dispatchFromBatch(tx, batchId, qty.parse(quantityKg), { userId: user.id, reference: reference || "Manual dispatch" }));
    revalidatePath(`/inventory/${batchId}`);
  }, "Dispatch recorded");
}

export async function adjustAction(batchId: string, newOnHand: number, reason: string) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    if (!reason || reason.trim().length < 5) throw new Error("Provide a reason (min 5 characters) — adjustments must be justified");
    await prisma.$transaction((tx) => adjustBatch(tx, batchId, z.coerce.number().min(0).parse(newOnHand), user.id, reason));
    revalidatePath(`/inventory/${batchId}`);
  }, "Stock adjusted");
}
