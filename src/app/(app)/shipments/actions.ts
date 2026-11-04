"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { BusinessError } from "@/lib/errors";
import { shipmentSchema, SHIPMENT_STATUSES } from "@/lib/schemas";
import { parseDateOnly, todayDate } from "@/lib/dates";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";

function data(v: z.output<typeof shipmentSchema>) {
  const pd = (s: string | null) => (s ? parseDateOnly(s) : null);
  return { ...v, etd: pd(v.etd), atd: pd(v.atd), eta: pd(v.eta), ata: pd(v.ata), containerNo: v.containerNo?.toUpperCase() ?? null };
}

export async function saveShipmentAction(id: string | null, orderIds: string[], values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("shipments:write");
    const v = shipmentSchema.parse(values);
    if (v.containerNo && !/^[A-Z]{4}\d{7}$/.test(v.containerNo.toUpperCase())) throw new BusinessError("Container number should follow ISO 6346 format (4 letters + 7 digits), e.g. MSCU1234567");
    const d = data(v);
    if (id) {
      await prisma.shipment.update({ where: { id }, data: d });
      await audit({ userId: user.id, action: "shipment.update", entity: "Shipment", entityId: id });
      revalidatePath(`/shipments/${id}`);
      return { id };
    }
    const s = await prisma.$transaction(async (tx) => {
      const orders = orderIds.length ? await tx.salesOrder.findMany({ where: { id: { in: orderIds } } }) : [];
      if (orders.some((o) => o.customerId !== v.customerId)) throw new BusinessError("All linked orders must belong to the shipment customer");
      return tx.shipment.create({ data: { ...d, shipmentNo: await nextNumber(tx, "SHP"), orders: { create: orders.map((o) => ({ orderId: o.id })) }, events: { create: { status: "PLANNING", note: "Shipment created", userId: user.id } } } });
    });
    await audit({ userId: user.id, action: "shipment.create", entity: "Shipment", entityId: s.id, summary: `Created ${s.shipmentNo}` });
    revalidatePath("/shipments");
    return { id: s.id };
  }, "Shipment saved");
}

export async function updateShipmentStatusAction(id: string, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("shipments:write");
    const v = z.object({ status: z.enum(SHIPMENT_STATUSES), note: z.string().max(500).optional(), location: z.string().max(120).optional() }).parse(values);
    const s = await prisma.shipment.findUniqueOrThrow({ where: { id }, include: { orders: true } });
    if (s.status === "CANCELLED" || s.status === "COMPLETED") throw new BusinessError(`Shipment is ${s.status.toLowerCase()}`);
    const today = todayDate();
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id }, data: { status: v.status, ...(v.status === "IN_TRANSIT" && !s.atd ? { atd: today } : {}), ...(v.status === "ARRIVED" && !s.ata ? { ata: today } : {}) } });
      await tx.shipmentEvent.create({ data: { shipmentId: id, status: v.status, note: v.note, location: v.location, userId: user.id } });
      const stage = v.status === "IN_TRANSIT" ? "SHIPPED" : v.status === "DELIVERED" ? "DELIVERED" : null;
      if (stage) await tx.customer.update({ where: { id: s.customerId }, data: { pipelineStage: stage } });
    });
    await audit({ userId: user.id, action: "shipment.status", entity: "Shipment", entityId: id, summary: `${s.shipmentNo} → ${v.status}` });
    revalidatePath(`/shipments/${id}`);
  }, "Shipment status updated");
}

export async function linkOrderAction(id: string, orderId?: string) {
  return runAction(async () => {
    await assertPermission("shipments:write");
    if (!orderId) throw new BusinessError("Choose an order");
    const [s, o] = await Promise.all([prisma.shipment.findUniqueOrThrow({ where: { id } }), prisma.salesOrder.findUniqueOrThrow({ where: { id: orderId } })]);
    if (s.customerId !== o.customerId) throw new BusinessError("Order belongs to a different customer");
    await prisma.shipmentOrder.upsert({ where: { shipmentId_orderId: { shipmentId: id, orderId } }, create: { shipmentId: id, orderId }, update: {} });
    revalidatePath(`/shipments/${id}`);
  }, "Order linked");
}
