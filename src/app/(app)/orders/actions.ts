"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { runAction } from "@/lib/action";
import { orderSchema } from "@/lib/schemas";
import { parseDateOnly } from "@/lib/dates";
import { cancelOrder, confirmOrder, createOrder, dispatchOrder, updateDraftOrder } from "@/lib/services/orders";
import { createInvoiceFromOrder } from "@/lib/services/finance";
import { getSetting } from "@/lib/options";

function toInput(v: z.output<typeof orderSchema>) {
  return {
    ...v, orderDate: parseDateOnly(v.orderDate), expectedShipmentDate: v.expectedShipmentDate ? parseDateOnly(v.expectedShipmentDate) : null,
    items: v.items.map((i) => ({ varietyId: i.varietyId, grade: i.grade, description: i.description || null, packaging: i.packaging || null, quantityKg: i.quantityKg, unitPrice: i.unitPrice, discountPct: i.discountPct })),
  };
}

export async function saveOrderAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("sales:write");
    const v = orderSchema.parse(values);
    if (id) {
      await prisma.$transaction((tx) => updateDraftOrder(tx, id, toInput(v), user.id));
      return { id };
    }
    const o = await prisma.$transaction((tx) => createOrder(tx, toInput(v), user.id));
    revalidatePath("/orders");
    return { id: o.id };
  }, "Order saved");
}

export async function confirmOrderAction(id: string, override?: boolean, reason?: string) {
  return runAction(async () => {
    const user = await assertPermission("sales:write");
    const strategy = (await getSetting<{ allocationStrategy: "FEFO" | "FIFO" }>("inventory", { allocationStrategy: "FEFO" })).allocationStrategy;
    const r = await prisma.$transaction((tx) => confirmOrder(tx, id, user.id, { override, overrideReason: reason, canOverride: hasPermission(user.role, "sales:override"), strategy }));
    revalidatePath(`/orders/${id}`);
    return r;
  }, "Order confirmed and inventory reserved");
}

export async function overrideConfirmAction(id: string, reason?: string) {
  return confirmOrderAction(id, true, reason);
}

const dispatchSchema = z.object({ shipmentId: z.string().optional(), lines: z.array(z.object({ orderItemId: z.string(), quantityKg: z.coerce.number().min(0), cartons: z.coerce.number().int().min(0).optional() })) });

export async function dispatchOrderAction(id: string, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("inventory:write");
    const v = dispatchSchema.parse(values);
    await prisma.$transaction((tx) => dispatchOrder(tx, id, v.lines, user.id, v.shipmentId || null));
    revalidatePath(`/orders/${id}`);
  }, "Dispatch recorded — inventory updated");
}

export async function cancelOrderAction(id: string, reason?: string) {
  return runAction(async () => {
    const user = await assertPermission("sales:write");
    await prisma.$transaction((tx) => cancelOrder(tx, id, user.id, reason || "Cancelled"));
    revalidatePath(`/orders/${id}`);
  }, "Order cancelled and reservations released");
}

export async function invoiceOrderAction(id: string, type: "SALES" | "PRO_FORMA") {
  return runAction(async () => {
    const user = await assertPermission("finance:write");
    const inv = await prisma.$transaction((tx) => createInvoiceFromOrder(tx, id, user.id, type));
    revalidatePath(`/orders/${id}`);
    return { id: inv.id };
  }, type === "SALES" ? "Draft invoice created" : "Pro forma invoice created");
}
