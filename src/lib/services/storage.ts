import type { Tx } from "@/lib/db";
import { D, money, sum } from "@/lib/money";
import { BusinessError } from "@/lib/errors";
import { computeContractBilling } from "@/lib/storage-billing";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { addDays, isoDate, todayDate } from "@/lib/dates";
import { assertRoomCapacity } from "./inventory";
import { createInvoice } from "./finance";

export const STORAGE_UNITS = ["kg-month", "storage"];

export async function createStorageContract(
  tx: Tx,
  input: {
    customerId: string;
    varietyId?: string | null;
    productDescription: string;
    batchReference?: string | null;
    coldRoomId: string;
    ratePerKgMonth: string | number;
    minimumPeriods?: number;
    entryDate: Date;
    quantityKg: string | number;
    notes?: string | null;
  },
  userId: string,
) {
  const qty = D(input.quantityKg);
  if (qty.lte(0)) throw new BusinessError("Quantity must be positive");
  if (D(input.ratePerKgMonth).lt(0)) throw new BusinessError("Rate cannot be negative");
  await assertRoomCapacity(tx, input.coldRoomId, qty);
  const contractNo = await nextNumber(tx, "CS");
  const c = await tx.storageContract.create({
    data: {
      contractNo,
      customerId: input.customerId,
      varietyId: input.varietyId || null,
      productDescription: input.productDescription,
      batchReference: input.batchReference,
      coldRoomId: input.coldRoomId,
      ratePerKgMonth: D(input.ratePerKgMonth).toFixed(4),
      minimumPeriods: input.minimumPeriods ?? 1,
      entryDate: input.entryDate,
      notes: input.notes,
      movements: { create: { type: "IN", quantityKg: qty.toFixed(3), date: input.entryDate, notes: "Initial entry" } },
    },
  });
  await audit({ userId, action: "storage.contract.create", entity: "StorageContract", entityId: c.id, summary: `${contractNo}: ${qty} kg` }, tx);
  return c;
}

export async function addStorageMovement(tx: Tx, contractId: string, type: "IN" | "OUT", quantityKg: string | number, date: Date, userId: string, notes?: string) {
  await tx.$queryRaw`SELECT id FROM "StorageContract" WHERE id = ${contractId} FOR UPDATE`;
  const c = await tx.storageContract.findUnique({ where: { id: contractId }, include: { movements: true } });
  if (!c) throw new BusinessError("Contract not found");
  if (c.status !== "ACTIVE") throw new BusinessError("Contract is not active");
  if (date < c.entryDate) throw new BusinessError("Movement date cannot precede the contract entry date");
  const qty = D(quantityKg);
  if (qty.lte(0)) throw new BusinessError("Quantity must be positive");
  if (type === "IN") await assertRoomCapacity(tx, c.coldRoomId, qty);
  const all = [...c.movements.map((m) => ({ type: m.type, quantityKg: m.quantityKg, date: m.date })), { type, quantityKg: qty, date }];
  // Validates chronological balance (throws if a removal exceeds stored quantity at that date)
  const result = computeContractBilling(all, { ratePerKgMonth: c.ratePerKgMonth, minimumPeriods: c.minimumPeriods }, date);
  await tx.storageMovement.create({ data: { contractId, type, quantityKg: qty.toFixed(3), date, notes } });
  if (result.onHandKg.lte(0)) {
    await tx.storageContract.update({ where: { id: contractId }, data: { exitDate: date } });
  }
  await audit({ userId, action: `storage.movement.${type.toLowerCase()}`, entity: "StorageContract", entityId: contractId, summary: `${type} ${qty} kg on ${isoDate(date)}` }, tx);
}

export async function contractBillingSummary(tx: Tx, contractId: string, asOf: Date = todayDate()) {
  const c = await tx.storageContract.findUnique({
    where: { id: contractId },
    include: { movements: true, adjustments: true, invoices: { where: { status: { not: "CANCELLED" } }, include: { items: true } } },
  });
  if (!c) throw new BusinessError("Contract not found");
  const billing = computeContractBilling(
    c.movements.map((m) => ({ type: m.type, quantityKg: m.quantityKg, date: m.date })),
    { ratePerKgMonth: c.ratePerKgMonth, minimumPeriods: c.minimumPeriods },
    asOf,
  );
  const previouslyBilled = sum(c.invoices.flatMap((i) => i.items.filter((it) => STORAGE_UNITS.includes(it.unit)).map((it) => it.lineTotal)));
  const pendingAdjustments = c.adjustments.filter((a) => !a.invoiceId);
  const adjustmentsTotal = sum(pendingAdjustments.map((a) => a.amount));
  const due = money(billing.total.minus(previouslyBilled));
  return { contract: c, billing, previouslyBilled, pendingAdjustments, adjustmentsTotal, due, amountToInvoice: due.plus(adjustmentsTotal) };
}

export async function generateStorageInvoice(tx: Tx, contractId: string, asOf: Date, userId: string) {
  await tx.$queryRaw`SELECT id FROM "StorageContract" WHERE id = ${contractId} FOR UPDATE`;
  const s = await contractBillingSummary(tx, contractId, asOf);
  if (s.amountToInvoice.lte(0)) throw new BusinessError("Nothing to invoice: all storage charges up to this date are already billed");
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: s.contract.customerId } });
  const rate = D(s.contract.ratePerKgMonth);
  const items: { description: string; quantity: string; unit: string; unitPrice: string }[] = [];
  if (s.previouslyBilled.eq(0)) {
    for (const sl of s.billing.slices) {
      items.push({
        description: `Cold storage ${sl.quantityKg.toFixed(0)} kg × ${sl.periods} billing month(s), ${sl.entryDate} → ${sl.exitDate}${sl.open ? " (in storage)" : ""}`,
        quantity: sl.quantityKg.mul(sl.periods).toFixed(3),
        unit: "kg-month",
        unitPrice: rate.toFixed(4),
      });
    }
  } else if (s.due.gt(0)) {
    items.push({ description: `Cold storage charges through ${isoDate(asOf)} (cumulative ${s.billing.total.toFixed(2)} less previously invoiced ${s.previouslyBilled.toFixed(2)})`, quantity: "1", unit: "storage", unitPrice: s.due.toFixed(2) });
  }
  for (const a of s.pendingAdjustments) items.push({ description: `Adjustment: ${a.reason}`, quantity: "1", unit: "adjustment", unitPrice: D(a.amount).toFixed(2) });
  // Negative adjustments are folded into a single discount-like line; computeLine forbids negative prices
  const negative = items.filter((i) => D(i.unitPrice).lt(0));
  const positive = items.filter((i) => D(i.unitPrice).gte(0));
  const headerDiscount = sum(negative.map((i) => D(i.unitPrice).abs()));
  const today = todayDate();
  const inv = await createInvoice(
    tx,
    {
      type: "COLD_STORAGE",
      customerId: s.contract.customerId,
      storageContractId: contractId,
      issueDate: today,
      dueDate: addDays(today, customer.paymentTermsDays),
      currency: "USD",
      billingPeriodEnd: asOf,
      headerDiscount: headerDiscount.toFixed(2),
      notes: `Storage contract ${s.contract.contractNo}. Rate ${rate.toFixed(4)} USD/kg/billing month; started billing months are charged in full.${negative.length ? ` Includes credit adjustments of ${headerDiscount.toFixed(2)}.` : ""}`,
      items: positive,
    },
    userId,
  );
  if (s.pendingAdjustments.length) await tx.storageAdjustment.updateMany({ where: { id: { in: s.pendingAdjustments.map((a) => a.id) } }, data: { invoiceId: inv.id } });
  return inv;
}
