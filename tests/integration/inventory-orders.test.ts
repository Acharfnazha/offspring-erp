import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import { receiveBatch, reserveBatch, releaseReservation, recordSpoilage, transferBatch, dispatchFromBatch } from "@/lib/services/inventory";
import { confirmOrder, createOrder, dispatchOrder, cancelOrder } from "@/lib/services/orders";
import { resetDb, fixtures } from "./helpers";

let f: Awaited<ReturnType<typeof fixtures>>;
beforeEach(async () => { await resetDb(); f = await fixtures(); });

const receive = (kg: number, opts: Partial<Parameters<typeof receiveBatch>[1]> = {}) =>
  prisma.$transaction((tx) => receiveBatch(tx, { varietyId: f.redDel.id, grade: "EXTRA", origin: "Lebanon", arrivalDate: f.d("2026-09-01"), quantityKg: kg, cartons: Math.ceil(kg / 18), costPerKg: "0.55", coldRoomId: f.room.id, ...opts }, f.user.id));

describe("inventory receiving", () => {
  it("creates a batch with a RECEIPT movement in a cold room", async () => {
    const b = await receive(20000);
    expect(b.batchNo).toMatch(/^LOT-\d{4}-\d{4}$/);
    const mv = await prisma.inventoryMovement.findMany({ where: { batchId: b.id } });
    expect(mv).toHaveLength(1);
    expect(mv[0].type).toBe("RECEIPT");
    expect(mv[0].onHandAfterKg.toString()).toBe("20000");
  });
  it("rejects receipts that exceed cold-room capacity", async () => {
    await expect(receive(120000)).rejects.toThrow(/capacity exceeded/);
  });
  it("blocks updates and deletes of the movement ledger at database level", async () => {
    const b = await receive(1000);
    await expect(prisma.inventoryMovement.updateMany({ where: { batchId: b.id }, data: { notes: "tamper" } })).rejects.toThrow(/append-only/);
    await expect(prisma.inventoryMovement.deleteMany({ where: { batchId: b.id } })).rejects.toThrow(/append-only/);
  });
});

describe("inventory reservation & movements", () => {
  it("reserves, prevents over-reservation and releases", async () => {
    const b = await receive(10000);
    const r = await prisma.$transaction((tx) => reserveBatch(tx, b.id, 6000, { userId: f.user.id }));
    await expect(prisma.$transaction((tx) => reserveBatch(tx, b.id, 4001, { userId: f.user.id }))).rejects.toThrow(/only 4000.0 kg available/);
    await prisma.$transaction((tx) => releaseReservation(tx, r.id, f.user.id));
    const after = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.reservedKg.toString()).toBe("0");
  });
  it("never allows negative stock (spoilage / dispatch beyond available)", async () => {
    const b = await receive(500);
    await expect(prisma.$transaction((tx) => recordSpoilage(tx, b.id, 501, f.user.id))).rejects.toThrow();
    await expect(prisma.$transaction((tx) => dispatchFromBatch(tx, b.id, 600, { userId: f.user.id }))).rejects.toThrow(/only 500.0 kg/);
    await prisma.$transaction((tx) => recordSpoilage(tx, b.id, 100, f.user.id, "bruised"));
    const after = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.onHandKg.toString()).toBe("400");
  });
  it("splits a batch on partial transfer and keeps total quantity", async () => {
    const b = await receive(10000);
    const child = await prisma.$transaction((tx) => transferBatch(tx, b.id, f.room2.id, 2500, f.user.id));
    const [parent, kid] = await Promise.all([prisma.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } }), prisma.inventoryBatch.findUniqueOrThrow({ where: { id: child.id } })]);
    expect(parent.onHandKg.toString()).toBe("7500");
    expect(kid.onHandKg.toString()).toBe("2500");
    expect(kid.coldRoomId).toBe(f.room2.id);
    expect(kid.batchNo).toBe(`${b.batchNo}-S1`);
  });
  it("serializes concurrent reservations without overselling", async () => {
    const b = await receive(1000);
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => prisma.$transaction((tx) => reserveBatch(tx, b.id, 300, { userId: f.user.id }))));
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(3);
    const after = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.reservedKg.toString()).toBe("900");
  });
});

describe("order fulfillment", () => {
  const order = (kg: number) => prisma.$transaction((tx) => createOrder(tx, { customerId: f.customer.id, orderDate: f.d("2026-10-01"), currency: "USD", incoterm: "CFR", items: [{ varietyId: f.redDel.id, grade: "EXTRA", quantityKg: kg, unitPrice: "1.10" }] }, f.user.id));

  it("confirms with FEFO reservations, partially then fully dispatches, tracking COGS", async () => {
    await receive(8000, { expiryDate: f.d("2027-02-01") });
    const early = await receive(8000, { expiryDate: f.d("2026-12-01") });
    const o = await order(12000);
    expect(o.total.toString()).toBe("13200");
    await prisma.$transaction((tx) => confirmOrder(tx, o.id, f.user.id, {}));
    const res = await prisma.inventoryReservation.findMany({ where: { orderItem: { orderId: o.id } }, orderBy: { createdAt: "asc" } });
    expect(res[0].batchId).toBe(early.id); // earliest expiry first
    expect(res.reduce((a, r) => a.plus(r.quantityKg), D(0)).toString()).toBe("12000");
    const item = (await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } }));
    await prisma.$transaction((tx) => dispatchOrder(tx, o.id, [{ orderItemId: item.id, quantityKg: 5000 }], f.user.id));
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PARTIALLY_FULFILLED");
    await expect(prisma.$transaction((tx) => dispatchOrder(tx, o.id, [{ orderItemId: item.id, quantityKg: 7001 }], f.user.id))).rejects.toThrow(/exceeds outstanding/);
    await prisma.$transaction((tx) => dispatchOrder(tx, o.id, [{ orderItemId: item.id, quantityKg: 7000 }], f.user.id));
    const done = await prisma.salesOrder.findUniqueOrThrow({ where: { id: o.id }, include: { items: true } });
    expect(done.status).toBe("FULFILLED");
    expect(done.items[0].cogsAmount.toString()).toBe("6600"); // 12000 × 0.55
    const stock = await prisma.inventoryBatch.aggregate({ _sum: { onHandKg: true, reservedKg: true } });
    expect(stock._sum.onHandKg?.toString()).toBe("4000");
    expect(stock._sum.reservedKg?.toString()).toBe("0");
  });
  it("refuses to confirm beyond available stock without an authorized override", async () => {
    await receive(5000);
    const o = await order(6000);
    await expect(prisma.$transaction((tx) => confirmOrder(tx, o.id, f.user.id, {}))).rejects.toThrow(/Insufficient inventory/);
    await expect(prisma.$transaction((tx) => confirmOrder(tx, o.id, f.user.id, { override: true, canOverride: false, overrideReason: "urgent buyer" }))).rejects.toThrow(/not authorized/);
    await prisma.$transaction((tx) => confirmOrder(tx, o.id, f.user.id, { override: true, canOverride: true, overrideReason: "Incoming harvest next week" }));
    const conf = await prisma.salesOrder.findUniqueOrThrow({ where: { id: o.id } });
    expect(conf.status).toBe("CONFIRMED");
    expect(conf.overrideReason).toMatch(/short 1000.0 kg/);
    // Transaction rolled back the failed attempts: only one set of reservations exists
    expect(await prisma.inventoryReservation.count()).toBe(1);
  });
  it("cancelling releases reservations", async () => {
    await receive(5000);
    const o = await order(3000);
    await prisma.$transaction((tx) => confirmOrder(tx, o.id, f.user.id, {}));
    await prisma.$transaction((tx) => cancelOrder(tx, o.id, f.user.id, "Buyer withdrew"));
    const b = await prisma.inventoryBatch.findFirstOrThrow();
    expect(b.reservedKg.toString()).toBe("0");
  });
});
