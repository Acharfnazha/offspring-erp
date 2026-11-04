import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { receiveBatch } from "@/lib/services/inventory";
import { confirmOrder, createOrder, dispatchOrder } from "@/lib/services/orders";
import { allocate, cancelInvoice, createCreditNote, createInvoice, createInvoiceFromOrder, issueInvoice, recordPayment, voidPayment } from "@/lib/services/finance";
import { addStorageMovement, contractBillingSummary, createStorageContract, generateStorageInvoice } from "@/lib/services/storage";
import { resetDb, fixtures } from "./helpers";

let f: Awaited<ReturnType<typeof fixtures>>;
beforeEach(async () => { await resetDb(); f = await fixtures(); });

async function issuedInvoice(total = 1000, customerId?: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await createInvoice(tx, { type: "SALES", customerId: customerId ?? f.customer.id, issueDate: f.d("2026-10-01"), dueDate: f.d("2099-10-31"), currency: "USD", items: [{ description: "Apples", quantity: total, unitPrice: 1 }] }, f.user.id);
    await issueInvoice(tx, inv.id, f.user.id);
    return tx.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  });
}
const pay = (amount: number | string, allocations: { invoiceId: string; amount: number | string }[], extra: Partial<Parameters<typeof recordPayment>[1]> = {}) =>
  prisma.$transaction((tx) => recordPayment(tx, { direction: "INCOMING", customerId: f.customer.id, method: "BANK_TRANSFER", amount, currency: "USD", paidAt: f.d("2026-10-05"), idempotencyKey: randomUUID(), allocations, ...extra }, f.user.id));

describe("invoice creation", () => {
  it("builds a sales invoice from dispatched order quantities with exact decimal totals", async () => {
    await prisma.$transaction((tx) => receiveBatch(tx, { varietyId: f.redDel.id, grade: "EXTRA", origin: "Lebanon", arrivalDate: f.d("2026-09-01"), quantityKg: 20000, cartons: 1112, costPerKg: "0.55", coldRoomId: f.room.id }, f.user.id));
    const o = await prisma.$transaction((tx) => createOrder(tx, { customerId: f.customer.id, orderDate: f.d("2026-10-01"), currency: "USD", incoterm: "FOB", headerDiscount: "100", items: [{ varietyId: f.redDel.id, grade: "EXTRA", quantityKg: 20000, unitPrice: "1.10", discountPct: 2.5 }] }, f.user.id));
    expect(o.total.toString()).toBe("21350"); // 22000 − 550 − 100
    await prisma.$transaction((tx) => confirmOrder(tx, o.id, f.user.id, {}));
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } });
    await prisma.$transaction((tx) => dispatchOrder(tx, o.id, [{ orderItemId: item.id, quantityKg: 15000 }], f.user.id));
    const inv = await prisma.$transaction((tx) => createInvoiceFromOrder(tx, o.id, f.user.id));
    expect(inv.status).toBe("DRAFT");
    expect(inv.subtotal.toString()).toBe("16500"); // 15000 dispatched × 1.10
    expect(inv.discountTotal.toString()).toBe("512.5"); // 2.5% line + 100 header
    expect(inv.total.toString()).toBe("15987.5");
    await expect(prisma.$transaction((tx) => createInvoiceFromOrder(tx, o.id, f.user.id))).rejects.toThrow(/already invoiced/);
  });
  it("rejects invalid totals and dates", async () => {
    await expect(prisma.$transaction((tx) => createInvoice(tx, { type: "SALES", customerId: f.customer.id, issueDate: f.d("2026-10-02"), dueDate: f.d("2026-10-01"), currency: "USD", items: [{ description: "x", quantity: 1, unitPrice: 1 }] }, f.user.id))).rejects.toThrow(/Due date/);
    await expect(prisma.$transaction((tx) => createInvoice(tx, { type: "SALES", customerId: f.customer.id, issueDate: f.d("2026-10-01"), dueDate: f.d("2026-10-30"), currency: "USD", items: [{ description: "x", quantity: 1, unitPrice: 0 }] }, f.user.id))).rejects.toThrow(/greater than zero/);
  });
});

describe("partial payments, allocation and duplicates", () => {
  it("records partial then full payment and updates balances/status", async () => {
    const inv = await issuedInvoice(1000);
    await pay("400.00", [{ invoiceId: inv.id, amount: "400.00" }]);
    let cur = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(cur.status).toBe("PARTIALLY_PAID");
    expect(cur.amountPaid.toString()).toBe("400");
    await pay("600.00", [{ invoiceId: inv.id, amount: "600.00" }]);
    cur = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(cur.status).toBe("PAID");
  });
  it("prevents over-allocation, wrong customer, and duplicate submissions", async () => {
    const inv = await issuedInvoice(1000);
    await expect(pay(1200, [{ invoiceId: inv.id, amount: 1200 }])).rejects.toThrow(/exceeds/);
    await expect(pay(100, [{ invoiceId: inv.id, amount: 150 }])).rejects.toThrow(/exceeds the payment amount/);
    const other = await issuedInvoice(500, f.customer2.id);
    await expect(pay(100, [{ invoiceId: other.id, amount: 100 }])).rejects.toThrow(/does not belong/);
    const key = randomUUID();
    await pay(100, [{ invoiceId: inv.id, amount: 100 }], { idempotencyKey: key, reference: "SWIFT-1" });
    await expect(pay(100, [{ invoiceId: inv.id, amount: 100 }], { idempotencyKey: key })).rejects.toThrow(/already recorded/);
    await expect(pay(100, [{ invoiceId: inv.id, amount: 100 }], { reference: "SWIFT-1" })).rejects.toThrow(/Duplicate prevented/);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).amountPaid.toString()).toBe("100");
  });
  it("keeps advance payments on account and allocates them later; void restores balance", async () => {
    const adv = await pay(700, []);
    const inv = await issuedInvoice(500);
    await prisma.$transaction((tx) => allocate(tx, adv.id, inv.id, 500));
    await expect(prisma.$transaction((tx) => allocate(tx, adv.id, inv.id, 1))).rejects.toThrow();
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("PAID");
    await prisma.$transaction((tx) => voidPayment(tx, adv.id, f.user.id, "bounced"));
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.amountPaid.toString()).toBe("0");
    expect(after.status).toBe("ISSUED");
  });
  it("credit notes reduce the open balance; paid invoices cannot be cancelled", async () => {
    const inv = await issuedInvoice(1000);
    await prisma.$transaction((tx) => createCreditNote(tx, inv.id, 250, "Quality claim", f.user.id));
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).amountPaid.toString()).toBe("250");
    await expect(prisma.$transaction((tx) => createCreditNote(tx, inv.id, 800, "too much", f.user.id))).rejects.toThrow(/exceeds the open balance/);
    await expect(prisma.$transaction((tx) => cancelInvoice(tx, inv.id, f.user.id, "x"))).rejects.toThrow(/payments or credits/);
  });
});

describe("storage contract billing", () => {
  it("bills staged removals per quantity and invoices incrementally without double counting", async () => {
    const c = await prisma.$transaction((tx) => createStorageContract(tx, { customerId: f.customer.id, productDescription: "Apples", coldRoomId: f.room.id, ratePerKgMonth: "0.05", entryDate: f.d("2026-01-10"), quantityKg: 10000 }, f.user.id));
    // 10,000 kg × 1 month = $500 at exactly one month
    let s = await contractBillingSummary(prisma, c.id, f.d("2026-02-10"));
    expect(s.billing.total.toFixed(2)).toBe("500.00");
    // one day more = 2 months = $1,000
    s = await contractBillingSummary(prisma, c.id, f.d("2026-02-11"));
    expect(s.billing.total.toFixed(2)).toBe("1000.00");
    const inv1 = await prisma.$transaction((tx) => generateStorageInvoice(tx, c.id, f.d("2026-02-11"), f.user.id));
    expect(inv1.total.toString()).toBe("1000");
    await expect(prisma.$transaction((tx) => generateStorageInvoice(tx, c.id, f.d("2026-02-11"), f.user.id))).rejects.toThrow(/Nothing to invoice/);
    // Remove 4,000 kg on Mar 5 (2 months) and the rest on Apr 20 (4 months)
    await prisma.$transaction((tx) => addStorageMovement(tx, c.id, "OUT", 4000, f.d("2026-03-05"), f.user.id));
    await expect(prisma.$transaction((tx) => addStorageMovement(tx, c.id, "OUT", 7000, f.d("2026-04-20"), f.user.id))).rejects.toThrow(/exceeds stored quantity/);
    await prisma.$transaction((tx) => addStorageMovement(tx, c.id, "OUT", 6000, f.d("2026-04-20"), f.user.id));
    s = await contractBillingSummary(prisma, c.id, f.d("2026-05-01"));
    expect(s.billing.total.toFixed(2)).toBe("1600.00"); // 4000×0.05×2 + 6000×0.05×4
    expect(s.due.toFixed(2)).toBe("600.00");
    await prisma.storageAdjustment.create({ data: { contractId: c.id, amount: "-50", reason: "Goodwill discount" } });
    const inv2 = await prisma.$transaction((tx) => generateStorageInvoice(tx, c.id, f.d("2026-05-01"), f.user.id));
    expect(inv2.total.toString()).toBe("550");
    const closed = await prisma.storageContract.findUniqueOrThrow({ where: { id: c.id } });
    expect(closed.exitDate?.toISOString().slice(0, 10)).toBe("2026-04-20");
  });
});
