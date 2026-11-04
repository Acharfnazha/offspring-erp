import type { Grade, Incoterm } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { D, Decimal } from "@/lib/money";
import { BusinessError } from "@/lib/errors";
import { computeTotals } from "@/lib/invoice-math";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { allocationCandidates, dispatchFromBatch, releaseReservation, reserveBatch } from "./inventory";

export interface OrderItemInput {
  varietyId: string;
  grade: Grade;
  description?: string | null;
  packaging?: string | null;
  quantityKg: string | number;
  unitPrice: string | number;
  discountPct?: string | number;
}

export interface OrderInput {
  customerId: string;
  orderDate: Date;
  currency: string;
  exchangeRate?: string | number;
  incoterm: Incoterm;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  expectedShipmentDate?: Date | null;
  headerDiscount?: string | number;
  notes?: string | null;
  quotationId?: string | null;
  items: OrderItemInput[];
}

function itemRows(items: OrderItemInput[]) {
  const totals = computeTotals(items.map((i) => ({ quantity: i.quantityKg, unitPrice: i.unitPrice, discountPct: i.discountPct ?? 0 })));
  return {
    totals,
    rows: items.map((i, idx) => ({
      varietyId: i.varietyId,
      grade: i.grade,
      description: i.description,
      packaging: i.packaging,
      quantityKg: D(i.quantityKg).toFixed(3),
      unitPrice: D(i.unitPrice).toFixed(4),
      discountPct: D(i.discountPct ?? 0).toFixed(2),
      lineTotal: totals.lines[idx].net.toFixed(2),
    })),
  };
}

export async function createOrder(tx: Tx, input: OrderInput, userId: string) {
  if (!input.items.length) throw new BusinessError("An order needs at least one item");
  for (const i of input.items) if (D(i.quantityKg).lte(0)) throw new BusinessError("Item quantities must be positive");
  const { totals, rows } = itemRows(input.items);
  const hd = D(input.headerDiscount ?? 0);
  if (hd.gt(totals.subtotal.minus(totals.discountTotal))) throw new BusinessError("Discount cannot exceed order value");
  const orderNo = await nextNumber(tx, "SO");
  const order = await tx.salesOrder.create({
    data: {
      orderNo,
      customerId: input.customerId,
      quotationId: input.quotationId ?? null,
      orderDate: input.orderDate,
      currency: input.currency,
      exchangeRate: D(input.exchangeRate ?? 1).toFixed(6),
      incoterm: input.incoterm,
      paymentTerms: input.paymentTerms,
      deliveryTerms: input.deliveryTerms,
      expectedShipmentDate: input.expectedShipmentDate ?? null,
      subtotal: totals.subtotal.toFixed(2),
      discountTotal: totals.discountTotal.plus(hd).toFixed(2),
      total: totals.total.minus(hd).toFixed(2),
      notes: input.notes,
      createdById: userId,
      items: { create: rows },
      events: { create: { type: "CREATED", userId, note: input.quotationId ? "Created from quotation" : undefined } },
    },
  });
  await audit({ userId, action: "order.create", entity: "SalesOrder", entityId: order.id, summary: `Created ${orderNo}` }, tx);
  return order;
}

export async function updateDraftOrder(tx: Tx, orderId: string, input: OrderInput, userId: string) {
  const existing = await tx.salesOrder.findUnique({ where: { id: orderId } });
  if (!existing) throw new BusinessError("Order not found");
  if (existing.status !== "DRAFT") throw new BusinessError("Only draft orders can be edited");
  const { totals, rows } = itemRows(input.items);
  const hd = D(input.headerDiscount ?? 0);
  await tx.orderItem.deleteMany({ where: { orderId } });
  await tx.salesOrder.update({
    where: { id: orderId },
    data: {
      customerId: input.customerId,
      orderDate: input.orderDate,
      currency: input.currency,
      exchangeRate: D(input.exchangeRate ?? 1).toFixed(6),
      incoterm: input.incoterm,
      paymentTerms: input.paymentTerms,
      deliveryTerms: input.deliveryTerms,
      expectedShipmentDate: input.expectedShipmentDate ?? null,
      subtotal: totals.subtotal.toFixed(2),
      discountTotal: totals.discountTotal.plus(hd).toFixed(2),
      total: totals.total.minus(hd).toFixed(2),
      notes: input.notes,
      items: { create: rows },
      events: { create: { type: "UPDATED", userId } },
    },
  });
}

export interface ConfirmOptions {
  override?: boolean;
  overrideReason?: string;
  canOverride?: boolean;
  strategy?: "FEFO" | "FIFO";
}

/** Confirms an order and reserves inventory (FEFO/FIFO). Shortfalls require an authorized, recorded override. */
export async function confirmOrder(tx: Tx, orderId: string, userId: string, opts: ConfirmOptions = {}) {
  await tx.$queryRaw`SELECT id FROM "SalesOrder" WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: { include: { variety: true } } } });
  if (!order) throw new BusinessError("Order not found");
  if (order.status !== "DRAFT") throw new BusinessError(`Order is already ${order.status.toLowerCase()}`);

  const shortfalls: string[] = [];
  for (const item of order.items) {
    let need = D(item.quantityKg);
    const candidates = await allocationCandidates(tx, item.varietyId, item.grade, opts.strategy ?? "FEFO");
    for (const b of candidates) {
      if (need.lte(0)) break;
      const avail = D(b.onHandKg).minus(D(b.reservedKg));
      const take = Decimal.min(avail, need);
      if (take.lte(0)) continue;
      await reserveBatch(tx, b.id, take, { orderItemId: item.id, userId, reference: order.orderNo });
      need = need.minus(take);
    }
    if (need.gt(0)) shortfalls.push(`${item.variety.name} (${item.grade.replace("_", " ")}): short ${need.toFixed(1)} kg`);
  }

  if (shortfalls.length) {
    if (!opts.override) throw new BusinessError(`Insufficient inventory — ${shortfalls.join("; ")}. An authorized override is required.`);
    if (!opts.canOverride) throw new BusinessError("You are not authorized to override inventory availability.");
    if (!opts.overrideReason || opts.overrideReason.trim().length < 5) throw new BusinessError("Provide a reason for the inventory override (min 5 characters).");
  }

  await tx.salesOrder.update({
    where: { id: orderId },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      overrideReason: shortfalls.length ? `${opts.overrideReason} [${shortfalls.join("; ")}]` : null,
      overrideById: shortfalls.length ? userId : null,
      events: { create: { type: shortfalls.length ? "CONFIRMED_WITH_OVERRIDE" : "CONFIRMED", userId, note: shortfalls.join("; ") || undefined } },
    },
  });
  await tx.customer.update({ where: { id: order.customerId }, data: { pipelineStage: "ORDER_CONFIRMED" } });
  await audit({ userId, action: shortfalls.length ? "order.confirm_override" : "order.confirm", entity: "SalesOrder", entityId: orderId, summary: shortfalls.length ? `Override: ${opts.overrideReason}` : `Confirmed ${order.orderNo}` }, tx);
  return { shortfalls };
}

export interface DispatchLine {
  orderItemId: string;
  quantityKg: string | number;
  cartons?: number;
}

/** Dispatches order lines: consumes the order's reservations first, then unreserved stock (FEFO). */
export async function dispatchOrder(tx: Tx, orderId: string, lines: DispatchLine[], userId: string, shipmentId?: string | null) {
  await tx.$queryRaw`SELECT id FROM "SalesOrder" WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: { include: { reservations: true, variety: true } } } });
  if (!order) throw new BusinessError("Order not found");
  if (!["CONFIRMED", "PARTIALLY_FULFILLED"].includes(order.status)) throw new BusinessError("Only confirmed orders can be dispatched");
  let anyDispatched = false;

  for (const line of lines) {
    const qty = D(line.quantityKg);
    if (qty.eq(0)) continue;
    if (qty.lt(0)) throw new BusinessError("Dispatch quantity must be positive");
    const item = order.items.find((i) => i.id === line.orderItemId);
    if (!item) throw new BusinessError("Order line not found");
    const outstanding = D(item.quantityKg).minus(D(item.fulfilledKg));
    if (qty.gt(outstanding)) throw new BusinessError(`${item.variety.name}: dispatch ${qty.toFixed(1)} kg exceeds outstanding ${outstanding.toFixed(1)} kg`);

    let need = qty;
    let cogs = new Decimal(0);
    const active = item.reservations.filter((r) => r.status === "ACTIVE").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const r of active) {
      if (need.lte(0)) break;
      const rem = D(r.quantityKg).minus(D(r.fulfilledKg));
      const take = Decimal.min(rem, need);
      if (take.lte(0)) continue;
      cogs = cogs.plus(await dispatchFromBatch(tx, r.batchId, take, { reservationId: r.id, userId, reference: order.orderNo }));
      need = need.minus(take);
    }
    if (need.gt(0)) {
      const candidates = await allocationCandidates(tx, item.varietyId, item.grade);
      for (const b of candidates) {
        if (need.lte(0)) break;
        const take = Decimal.min(D(b.onHandKg).minus(D(b.reservedKg)), need);
        if (take.lte(0)) continue;
        cogs = cogs.plus(await dispatchFromBatch(tx, b.id, take, { userId, reference: order.orderNo }));
        need = need.minus(take);
      }
    }
    if (need.gt(0)) throw new BusinessError(`${item.variety.name}: insufficient stock to dispatch — short ${need.toFixed(1)} kg`);

    await tx.orderItem.update({
      where: { id: item.id },
      data: { fulfilledKg: D(item.fulfilledKg).plus(qty).toFixed(3), cogsAmount: D(item.cogsAmount).plus(cogs).toFixed(2) },
    });
    if (shipmentId) await tx.shipmentItem.create({ data: { shipmentId, orderItemId: item.id, quantityKg: qty.toFixed(3), cartons: line.cartons } });
    anyDispatched = true;
  }
  if (!anyDispatched) throw new BusinessError("Enter at least one quantity to dispatch");

  const items = await tx.orderItem.findMany({ where: { orderId } });
  const complete = items.every((i) => D(i.fulfilledKg).gte(D(i.quantityKg)));
  if (complete) {
    // Release any reservation leftovers
    const leftovers = await tx.inventoryReservation.findMany({ where: { orderItem: { orderId }, status: "ACTIVE" } });
    for (const r of leftovers) await releaseReservation(tx, r.id, userId, "Order fulfilled");
  }
  await tx.salesOrder.update({
    where: { id: orderId },
    data: { status: complete ? "FULFILLED" : "PARTIALLY_FULFILLED", events: { create: { type: complete ? "FULFILLED" : "PARTIALLY_DISPATCHED", userId } } },
  });
  await tx.customer.update({ where: { id: order.customerId }, data: { pipelineStage: "SHIPMENT_PREPARATION" } });
  await audit({ userId, action: "order.dispatch", entity: "SalesOrder", entityId: orderId, summary: `Dispatched lines for ${order.orderNo}` }, tx);
}

export async function cancelOrder(tx: Tx, orderId: string, userId: string, reason: string) {
  const order = await tx.salesOrder.findUnique({ where: { id: orderId }, include: { items: true, invoices: { where: { status: { not: "CANCELLED" } } } } });
  if (!order) throw new BusinessError("Order not found");
  if (order.status === "CANCELLED") throw new BusinessError("Order is already cancelled");
  if (order.items.some((i) => D(i.fulfilledKg).gt(0))) throw new BusinessError("Goods were already dispatched for this order; it cannot be cancelled. Issue a credit note instead.");
  if (order.invoices.length) throw new BusinessError("Cancel the related invoices first.");
  const active = await tx.inventoryReservation.findMany({ where: { orderItem: { orderId }, status: "ACTIVE" } });
  for (const r of active) await releaseReservation(tx, r.id, userId, `Order ${order.orderNo} cancelled`);
  await tx.salesOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason, events: { create: { type: "CANCELLED", userId, note: reason } } },
  });
  await audit({ userId, action: "order.cancel", entity: "SalesOrder", entityId: orderId, summary: reason }, tx);
}
