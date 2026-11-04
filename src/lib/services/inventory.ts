import type { Grade, MovementType, InventoryBatch, BatchStatus } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { D, Decimal, type DecimalLike } from "@/lib/money";
import { BusinessError } from "@/lib/errors";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";

const kg = (v: DecimalLike) => D(v).toDecimalPlaces(3);

/** Row-level lock to serialize concurrent operations on the same batch. */
async function lockBatch(tx: Tx, batchId: string): Promise<InventoryBatch> {
  await tx.$queryRaw`SELECT id FROM "InventoryBatch" WHERE id = ${batchId} FOR UPDATE`;
  const b = await tx.inventoryBatch.findUnique({ where: { id: batchId } });
  if (!b) throw new BusinessError("Inventory batch not found");
  return b;
}

export function availableKg(b: { onHandKg: DecimalLike; reservedKg: DecimalLike }): Decimal {
  return D(b.onHandKg).minus(D(b.reservedKg));
}

function nextStatus(current: BatchStatus, onHand: Decimal, reserved: Decimal): BatchStatus {
  if (current === "QUARANTINE" || current === "SPOILED") return onHand.lte(0) ? "DEPLETED" : current;
  if (onHand.lte(0)) return "DEPLETED";
  if (reserved.gte(onHand)) return "RESERVED";
  return "AVAILABLE";
}

async function writeBatch(
  tx: Tx,
  batch: InventoryBatch,
  onHand: Decimal,
  reserved: Decimal,
  movement: { type: MovementType; quantityKg: Decimal; reference?: string; notes?: string; userId?: string | null; cartons?: number },
  extra: Partial<{ coldRoomId: string | null; cartons: number }> = {},
) {
  if (onHand.lt(0)) throw new BusinessError(`Operation would make stock negative for batch ${batch.batchNo}`);
  if (reserved.lt(0)) throw new BusinessError(`Reserved quantity cannot be negative for batch ${batch.batchNo}`);
  if (reserved.gt(onHand)) throw new BusinessError(`Reserved quantity would exceed on-hand stock for batch ${batch.batchNo}`);
  const updated = await tx.inventoryBatch.update({
    where: { id: batch.id },
    data: {
      onHandKg: onHand.toFixed(3),
      reservedKg: reserved.toFixed(3),
      status: nextStatus(batch.status, onHand, reserved),
      ...extra,
    },
  });
  await tx.inventoryMovement.create({
    data: {
      batchId: batch.id,
      type: movement.type,
      quantityKg: movement.quantityKg.toFixed(3),
      onHandAfterKg: onHand.toFixed(3),
      reservedAfterKg: reserved.toFixed(3),
      cartons: movement.cartons,
      reference: movement.reference,
      notes: movement.notes,
      userId: movement.userId ?? null,
    },
  });
  return updated;
}

/** Current occupancy (kg) of a cold room: own inventory + customer goods under storage contracts. */
export async function roomOccupancyKg(tx: Tx, coldRoomId: string): Promise<Decimal> {
  const inv = await tx.inventoryBatch.aggregate({ where: { coldRoomId }, _sum: { onHandKg: true } });
  const rows = await tx.$queryRaw<{ net: string | null }[]>`
    SELECT SUM(CASE WHEN m."type" = 'IN' THEN m."quantityKg" ELSE -m."quantityKg" END)::text AS net
    FROM "StorageMovement" m JOIN "StorageContract" c ON c.id = m."contractId"
    WHERE c."coldRoomId" = ${coldRoomId} AND c."status" <> 'CANCELLED'`;
  return D(inv._sum.onHandKg).plus(D(rows[0]?.net));
}

export async function assertRoomCapacity(tx: Tx, coldRoomId: string, addKg: DecimalLike) {
  const room = await tx.coldRoom.findUnique({ where: { id: coldRoomId } });
  if (!room) throw new BusinessError("Cold room not found");
  if (room.status === "OFFLINE") throw new BusinessError(`Cold room ${room.code} is offline`);
  const occ = await roomOccupancyKg(tx, coldRoomId);
  if (occ.plus(D(addKg)).gt(D(room.capacityKg)))
    throw new BusinessError(
      `Cold room ${room.code} capacity exceeded: ${occ.toFixed(0)} kg occupied + ${D(addKg).toFixed(0)} kg > ${D(room.capacityKg).toFixed(0)} kg capacity`,
    );
}

export interface ReceiveInput {
  varietyId: string;
  grade: Grade;
  customGrade?: string | null;
  origin: string;
  supplierId?: string | null;
  goodsReceiptId?: string | null;
  harvestDate?: Date | null;
  arrivalDate: Date;
  expiryDate?: Date | null;
  quantityKg: DecimalLike;
  cartons: number;
  packagingType?: string | null;
  costPerKg: DecimalLike;
  coldRoomId?: string | null;
  notes?: string | null;
  reference?: string;
}

export async function receiveBatch(tx: Tx, input: ReceiveInput, userId?: string | null) {
  const qty = kg(input.quantityKg);
  if (qty.lte(0)) throw new BusinessError("Quantity must be greater than zero");
  if (D(input.costPerKg).lt(0)) throw new BusinessError("Cost per kg cannot be negative");
  if (input.coldRoomId) await assertRoomCapacity(tx, input.coldRoomId, qty);
  const batchNo = await nextNumber(tx, "LOT", { pad: 4 });
  const batch = await tx.inventoryBatch.create({
    data: {
      batchNo,
      varietyId: input.varietyId,
      grade: input.grade,
      customGrade: input.grade === "CUSTOM" ? input.customGrade : null,
      origin: input.origin,
      supplierId: input.supplierId || null,
      goodsReceiptId: input.goodsReceiptId || null,
      harvestDate: input.harvestDate ?? null,
      arrivalDate: input.arrivalDate,
      expiryDate: input.expiryDate ?? null,
      receivedKg: qty.toFixed(3),
      onHandKg: qty.toFixed(3),
      cartons: input.cartons,
      packagingType: input.packagingType,
      costPerKg: D(input.costPerKg).toFixed(4),
      coldRoomId: input.coldRoomId || null,
      notes: input.notes,
    },
  });
  await tx.inventoryMovement.create({
    data: {
      batchId: batch.id,
      type: "RECEIPT",
      quantityKg: qty.toFixed(3),
      onHandAfterKg: qty.toFixed(3),
      reservedAfterKg: "0",
      cartons: input.cartons,
      reference: input.reference ?? "Manual receipt",
      userId: userId ?? null,
    },
  });
  await audit({ userId, action: "inventory.receive", entity: "InventoryBatch", entityId: batch.id, summary: `Received ${qty} kg into ${batchNo}` }, tx);
  return batch;
}

export async function transferBatch(tx: Tx, batchId: string, toColdRoomId: string, quantityKg: DecimalLike, userId?: string | null, notes?: string) {
  const b = await lockBatch(tx, batchId);
  const qty = kg(quantityKg);
  if (qty.lte(0)) throw new BusinessError("Transfer quantity must be greater than zero");
  if (b.coldRoomId === toColdRoomId) throw new BusinessError("Batch is already in that cold room");
  const avail = availableKg(b);
  const onHand = D(b.onHandKg);
  const whole = qty.eq(onHand) && D(b.reservedKg).eq(0);
  if (!whole && qty.gt(avail)) throw new BusinessError(`Only ${avail.toFixed(1)} kg of ${b.batchNo} is unreserved and can be transferred`);
  await assertRoomCapacity(tx, toColdRoomId, qty);
  const room = await tx.coldRoom.findUniqueOrThrow({ where: { id: toColdRoomId } });

  if (whole) {
    await writeBatch(tx, b, onHand.minus(qty), D(0), { type: "TRANSFER_OUT", quantityKg: qty, reference: `To ${room.code}`, notes, userId });
    const reloaded = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } });
    await writeBatch(tx, reloaded, qty, D(0), { type: "TRANSFER_IN", quantityKg: qty, reference: `To ${room.code}`, notes, userId }, { coldRoomId: toColdRoomId });
    return b;
  }

  const cartonsMoved = b.cartons > 0 ? Math.round(qty.div(onHand).mul(b.cartons).toNumber()) : 0;
  const splitCount = await tx.inventoryBatch.count({ where: { parentBatchId: b.id } });
  const child = await tx.inventoryBatch.create({
    data: {
      batchNo: `${b.batchNo}-S${splitCount + 1}`,
      varietyId: b.varietyId,
      grade: b.grade,
      customGrade: b.customGrade,
      origin: b.origin,
      supplierId: b.supplierId,
      goodsReceiptId: b.goodsReceiptId,
      parentBatchId: b.id,
      harvestDate: b.harvestDate,
      arrivalDate: b.arrivalDate,
      expiryDate: b.expiryDate,
      receivedKg: "0",
      onHandKg: "0",
      cartons: 0,
      packagingType: b.packagingType,
      costPerKg: b.costPerKg,
      coldRoomId: toColdRoomId,
      notes: b.notes,
    },
  });
  await writeBatch(
    tx,
    b,
    onHand.minus(qty),
    D(b.reservedKg),
    { type: "TRANSFER_OUT", quantityKg: qty, reference: `Split to ${child.batchNo} @ ${room.code}`, notes, userId, cartons: cartonsMoved },
    { cartons: Math.max(b.cartons - cartonsMoved, 0) },
  );
  await writeBatch(
    tx,
    child,
    qty,
    D(0),
    { type: "TRANSFER_IN", quantityKg: qty, reference: `Split from ${b.batchNo}`, notes, userId, cartons: cartonsMoved },
    { cartons: cartonsMoved },
  );
  await audit({ userId, action: "inventory.transfer", entity: "InventoryBatch", entityId: b.id, summary: `Transferred ${qty} kg to ${room.code} as ${child.batchNo}` }, tx);
  return child;
}

export async function reserveBatch(tx: Tx, batchId: string, quantityKg: DecimalLike, opts: { orderItemId?: string; note?: string; userId?: string | null; reference?: string } = {}) {
  const b = await lockBatch(tx, batchId);
  const qty = kg(quantityKg);
  if (qty.lte(0)) throw new BusinessError("Reservation quantity must be greater than zero");
  if (b.status === "QUARANTINE" || b.status === "SPOILED") throw new BusinessError(`Batch ${b.batchNo} is ${b.status.toLowerCase()} and cannot be reserved`);
  const avail = availableKg(b);
  if (qty.gt(avail)) throw new BusinessError(`Cannot reserve ${qty.toFixed(1)} kg — only ${avail.toFixed(1)} kg available in ${b.batchNo}`);
  const reservation = await tx.inventoryReservation.create({
    data: { batchId: b.id, orderItemId: opts.orderItemId, quantityKg: qty.toFixed(3), note: opts.note },
  });
  await writeBatch(tx, b, D(b.onHandKg), D(b.reservedKg).plus(qty), {
    type: "RESERVE",
    quantityKg: qty,
    reference: opts.reference ?? opts.note,
    userId: opts.userId,
  });
  return reservation;
}

export async function releaseReservation(tx: Tx, reservationId: string, userId?: string | null, reason?: string) {
  const r = await tx.inventoryReservation.findUnique({ where: { id: reservationId } });
  if (!r) throw new BusinessError("Reservation not found");
  if (r.status !== "ACTIVE") throw new BusinessError("Reservation is not active");
  const b = await lockBatch(tx, r.batchId);
  const remaining = D(r.quantityKg).minus(D(r.fulfilledKg));
  await tx.inventoryReservation.update({ where: { id: r.id }, data: { status: "RELEASED" } });
  if (remaining.gt(0)) {
    await writeBatch(tx, b, D(b.onHandKg), D(b.reservedKg).minus(remaining), { type: "RELEASE", quantityKg: remaining, notes: reason, userId });
  }
  return remaining;
}

export async function recordSpoilage(tx: Tx, batchId: string, quantityKg: DecimalLike, userId?: string | null, notes?: string) {
  const b = await lockBatch(tx, batchId);
  const qty = kg(quantityKg);
  if (qty.lte(0)) throw new BusinessError("Spoilage quantity must be greater than zero");
  const avail = availableKg(b);
  if (qty.gt(avail)) throw new BusinessError(`Only ${avail.toFixed(1)} kg is unreserved; release reservations before recording more spoilage`);
  const updated = await writeBatch(tx, b, D(b.onHandKg).minus(qty), D(b.reservedKg), { type: "SPOILAGE", quantityKg: qty, notes, userId });
  await audit({ userId, action: "inventory.spoilage", entity: "InventoryBatch", entityId: b.id, summary: `Spoilage ${qty} kg on ${b.batchNo}` }, tx);
  return updated;
}

/** Dispatch stock out of a batch. If a reservation is given, the dispatch consumes it. Returns cost of goods (USD). */
export async function dispatchFromBatch(
  tx: Tx,
  batchId: string,
  quantityKg: DecimalLike,
  opts: { reservationId?: string; userId?: string | null; reference?: string; notes?: string } = {},
): Promise<Decimal> {
  const b = await lockBatch(tx, batchId);
  const qty = kg(quantityKg);
  if (qty.lte(0)) throw new BusinessError("Dispatch quantity must be greater than zero");
  let reserved = D(b.reservedKg);
  if (opts.reservationId) {
    const r = await tx.inventoryReservation.findUnique({ where: { id: opts.reservationId } });
    if (!r || r.batchId !== b.id || r.status !== "ACTIVE") throw new BusinessError("Reservation is not active for this batch");
    const rem = D(r.quantityKg).minus(D(r.fulfilledKg));
    if (qty.gt(rem)) throw new BusinessError(`Dispatch exceeds reserved quantity (${rem.toFixed(1)} kg)`);
    const fulfilled = D(r.fulfilledKg).plus(qty);
    await tx.inventoryReservation.update({
      where: { id: r.id },
      data: { fulfilledKg: fulfilled.toFixed(3), status: fulfilled.gte(D(r.quantityKg)) ? "FULFILLED" : "ACTIVE" },
    });
    reserved = reserved.minus(qty);
  } else {
    const avail = availableKg(b);
    if (qty.gt(avail)) throw new BusinessError(`Cannot dispatch ${qty.toFixed(1)} kg — only ${avail.toFixed(1)} kg unreserved in ${b.batchNo}`);
  }
  await writeBatch(tx, b, D(b.onHandKg).minus(qty), reserved, { type: "DISPATCH", quantityKg: qty, reference: opts.reference, notes: opts.notes, userId: opts.userId });
  return qty.mul(D(b.costPerKg)).toDecimalPlaces(2);
}

export async function adjustBatch(tx: Tx, batchId: string, newOnHandKg: DecimalLike, userId: string, reason: string) {
  const b = await lockBatch(tx, batchId);
  const target = kg(newOnHandKg);
  if (target.lt(D(b.reservedKg))) throw new BusinessError("Adjusted quantity cannot be below the reserved quantity");
  const delta = target.minus(D(b.onHandKg));
  if (delta.eq(0)) throw new BusinessError("No change in quantity");
  await writeBatch(tx, b, target, D(b.reservedKg), { type: "ADJUSTMENT", quantityKg: delta, notes: reason, userId });
  await audit({ userId, action: "inventory.adjust", entity: "InventoryBatch", entityId: b.id, summary: `Adjusted ${b.batchNo} by ${delta} kg: ${reason}`, before: { onHandKg: b.onHandKg }, after: { onHandKg: target.toFixed(3) } }, tx);
}

/** Candidate batches for allocation: FEFO when expiry dates exist (configurable), otherwise FIFO by arrival. */
export async function allocationCandidates(tx: Tx, varietyId: string, grade: Grade | null, strategy: "FEFO" | "FIFO" = "FEFO") {
  const batches = await tx.inventoryBatch.findMany({
    where: { varietyId, ...(grade ? { grade } : {}), status: { in: ["AVAILABLE", "RESERVED"] } },
    include: { coldRoom: true },
    orderBy: [{ arrivalDate: "asc" }, { createdAt: "asc" }],
  });
  const withAvail = batches.filter((b) => availableKg(b).gt(0));
  if (strategy === "FEFO") {
    withAvail.sort((a, b) => {
      const ea = a.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const eb = b.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ea - eb || a.arrivalDate.getTime() - b.arrivalDate.getTime();
    });
  }
  return withAvail;
}

export async function availableByVariety(varietyId: string, grade?: Grade | null) {
  const agg = await prisma.inventoryBatch.aggregate({
    where: { varietyId, ...(grade ? { grade } : {}), status: { in: ["AVAILABLE", "RESERVED"] } },
    _sum: { onHandKg: true, reservedKg: true },
  });
  return D(agg._sum.onHandKg).minus(D(agg._sum.reservedKg));
}
