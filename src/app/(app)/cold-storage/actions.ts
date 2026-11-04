"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { BusinessError } from "@/lib/errors";
import { coldRoomSchema, readingSchema, storageContractSchema } from "@/lib/schemas";
import { parseDateOnly } from "@/lib/dates";
import { audit } from "@/lib/audit";
import { D } from "@/lib/money";
import { recordReading } from "@/lib/services/coldrooms";
import { addStorageMovement, createStorageContract, generateStorageInvoice } from "@/lib/services/storage";
import { roomOccupancyKg } from "@/lib/services/inventory";

export async function saveRoomAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("storage:write");
    const v = coldRoomSchema.parse(values);
    if (id) {
      const occ = await roomOccupancyKg(prisma, id);
      if (D(v.capacityKg).lt(occ)) throw new BusinessError(`Capacity cannot be below current occupancy (${occ.toFixed(0)} kg)`);
      const before = await prisma.coldRoom.findUniqueOrThrow({ where: { id } });
      await prisma.coldRoom.update({ where: { id }, data: v });
      await audit({ userId: user.id, action: "coldroom.update", entity: "ColdRoom", entityId: id, summary: `Updated ${v.code}`, before, after: v });
      return { id };
    }
    const r = await prisma.coldRoom.create({ data: v });
    await audit({ userId: user.id, action: "coldroom.create", entity: "ColdRoom", entityId: r.id, summary: `Created ${v.code}` });
    revalidatePath("/cold-storage");
    return { id: r.id };
  }, "Cold room saved");
}

export async function recordReadingAction(roomId: string, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("storage:write");
    const v = readingSchema.parse(values);
    const r = await recordReading(roomId, v.temperatureC, v.humidity, "MANUAL", user.id);
    revalidatePath(`/cold-storage/rooms/${roomId}`);
    return r;
  }, "Reading recorded");
}

export async function createContractAction(values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("storage:write");
    const v = storageContractSchema.parse(values);
    const c = await prisma.$transaction((tx) => createStorageContract(tx, { ...v, entryDate: parseDateOnly(v.entryDate) }, user.id));
    revalidatePath("/cold-storage");
    return { id: c.id };
  }, "Storage contract created");
}

const mv = z.object({ type: z.enum(["IN", "OUT"]), quantityKg: z.coerce.number().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().max(500).optional() });

export async function storageMovementAction(contractId: string, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("storage:write");
    const v = mv.parse(values);
    await prisma.$transaction((tx) => addStorageMovement(tx, contractId, v.type, v.quantityKg, parseDateOnly(v.date), user.id, v.notes));
    revalidatePath(`/cold-storage/contracts/${contractId}`);
  }, "Storage movement recorded");
}

export async function generateStorageInvoiceAction(contractId: string, asOf: string) {
  return runAction(async () => {
    const user = await assertPermission("storage:billing");
    const inv = await prisma.$transaction((tx) => generateStorageInvoice(tx, contractId, parseDateOnly(asOf), user.id));
    revalidatePath(`/cold-storage/contracts/${contractId}`);
    return { id: inv.id };
  }, "Storage invoice generated (draft)");
}

export async function storageAdjustmentAction(contractId: string, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("storage:billing");
    const v = z.object({ amount: z.coerce.number().refine((x) => x !== 0, "Amount cannot be zero"), reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(300) }).parse(values);
    const a = await prisma.storageAdjustment.create({ data: { contractId, amount: D(v.amount).toFixed(2), reason: v.reason, createdById: user.id } });
    await audit({ userId: user.id, action: "storage.adjustment", entity: "StorageContract", entityId: contractId, summary: `Manual adjustment ${a.amount} USD: ${v.reason}` });
    revalidatePath(`/cold-storage/contracts/${contractId}`);
  }, "Adjustment recorded — it will be included in the next storage invoice");
}

export async function closeContractAction(contractId: string) {
  return runAction(async () => {
    const user = await assertPermission("storage:write");
    const c = await prisma.storageContract.findUniqueOrThrow({ where: { id: contractId }, include: { movements: true } });
    const onHand = c.movements.reduce((a, m) => (m.type === "IN" ? a.plus(m.quantityKg) : a.minus(m.quantityKg)), D(0));
    if (onHand.gt(0)) throw new BusinessError(`Record the removal of the remaining ${onHand.toFixed(0)} kg before closing`);
    await prisma.storageContract.update({ where: { id: contractId }, data: { status: "CLOSED" } });
    await audit({ userId: user.id, action: "storage.close", entity: "StorageContract", entityId: contractId });
  }, "Contract closed");
}
