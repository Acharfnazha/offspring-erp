import type { InvoiceType, PaymentDirection, PaymentMethod, Incoterm } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { D, money, sum, Decimal } from "@/lib/money";
import { BusinessError } from "@/lib/errors";
import { computeTotals, deriveInvoiceStatus } from "@/lib/invoice-math";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { addDays, todayDate } from "@/lib/dates";

const PREFIX: Record<InvoiceType, string> = { SALES: "INV", PURCHASE: "PINV", COLD_STORAGE: "CSI", PRO_FORMA: "PRO", CREDIT_NOTE: "CN" };

export interface InvoiceItemInput {
  description: string;
  quantity: string | number;
  unit?: string;
  unitPrice: string | number;
  discountPct?: string | number;
  taxPct?: string | number;
}

export interface InvoiceInput {
  type: InvoiceType;
  customerId?: string | null;
  supplierId?: string | null;
  salesOrderId?: string | null;
  purchaseOrderId?: string | null;
  storageContractId?: string | null;
  shipmentId?: string | null;
  originalInvoiceId?: string | null;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  exchangeRate?: string | number;
  incoterm?: Incoterm | null;
  headerDiscount?: string | number;
  billingPeriodEnd?: Date | null;
  notes?: string | null;
  items: InvoiceItemInput[];
  issue?: boolean;
}

export async function createInvoice(tx: Tx, input: InvoiceInput, userId: string | null) {
  if (!input.items.length) throw new BusinessError("An invoice needs at least one line");
  if (input.type === "PURCHASE" ? !input.supplierId : !input.customerId) throw new BusinessError(input.type === "PURCHASE" ? "Select a supplier" : "Select a customer");
  if (input.dueDate < input.issueDate) throw new BusinessError("Due date cannot be before the issue date");
  const totals = computeTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct ?? 0, taxPct: i.taxPct ?? 0 })),
    input.headerDiscount ?? 0,
  );
  if (totals.total.lte(0)) throw new BusinessError("Invoice total must be greater than zero");
  const invoiceNo = await nextNumber(tx, PREFIX[input.type]);
  const invoice = await tx.invoice.create({
    data: {
      invoiceNo,
      type: input.type,
      status: input.issue ? "ISSUED" : "DRAFT",
      customerId: input.customerId || null,
      supplierId: input.supplierId || null,
      salesOrderId: input.salesOrderId || null,
      purchaseOrderId: input.purchaseOrderId || null,
      storageContractId: input.storageContractId || null,
      shipmentId: input.shipmentId || null,
      originalInvoiceId: input.originalInvoiceId || null,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      currency: input.currency,
      exchangeRate: D(input.exchangeRate ?? 1).toFixed(6),
      incoterm: input.incoterm ?? null,
      billingPeriodEnd: input.billingPeriodEnd ?? null,
      subtotal: totals.subtotal.toFixed(2),
      discountTotal: totals.discountTotal.toFixed(2),
      taxTotal: totals.taxTotal.toFixed(2),
      total: totals.total.toFixed(2),
      notes: input.notes,
      createdById: userId,
      items: {
        create: input.items.map((i, idx) => ({
          description: i.description,
          quantity: D(i.quantity).toFixed(3),
          unit: i.unit ?? "kg",
          unitPrice: D(i.unitPrice).toFixed(4),
          discountPct: D(i.discountPct ?? 0).toFixed(2),
          taxPct: D(i.taxPct ?? 0).toFixed(2),
          lineTotal: totals.lines[idx].total.toFixed(2),
          sortOrder: idx,
        })),
      },
    },
  });
  await audit({ userId, action: "invoice.create", entity: "Invoice", entityId: invoice.id, summary: `${invoiceNo} total ${totals.total.toFixed(2)} ${input.currency}` }, tx);
  return invoice;
}

/** Builds a sales invoice from an order: dispatched quantities when any were dispatched, otherwise ordered quantities. */
export async function createInvoiceFromOrder(tx: Tx, orderId: string, userId: string, type: "SALES" | "PRO_FORMA" = "SALES") {
  const order = await tx.salesOrder.findUnique({
    where: { id: orderId },
    include: { customer: true, items: { include: { variety: { include: { product: true } } } }, invoices: { where: { status: { not: "CANCELLED" }, type } } },
  });
  if (!order) throw new BusinessError("Order not found");
  if (order.status === "DRAFT" || order.status === "CANCELLED") throw new BusinessError("Confirm the order before invoicing");
  if (type === "SALES" && order.invoices.length) throw new BusinessError(`Order already invoiced (${order.invoices.map((i) => i.invoiceNo).join(", ")})`);
  const anyDispatched = order.items.some((i) => D(i.fulfilledKg).gt(0));
  const items = order.items
    .map((i) => ({
      description: `${i.variety.product.name} — ${i.variety.name}, ${i.grade.replace("_", " ")}${i.packaging ? `, ${i.packaging}` : ""}`,
      quantity: (type === "SALES" && anyDispatched ? D(i.fulfilledKg) : D(i.quantityKg)).toFixed(3),
      unit: "kg",
      unitPrice: i.unitPrice.toString(),
      discountPct: i.discountPct.toString(),
    }))
    .filter((i) => D(i.quantity).gt(0));
  const lineDisc = sum(order.items.map((i) => money(D(i.quantityKg).mul(D(i.unitPrice)).mul(D(i.discountPct)).div(100))));
  const headerDiscount = Decimal.max(D(order.discountTotal).minus(lineDisc), 0);
  const issue = todayDate();
  const inv = await createInvoice(
    tx,
    {
      type,
      customerId: order.customerId,
      salesOrderId: order.id,
      issueDate: issue,
      dueDate: addDays(issue, order.customer.paymentTermsDays),
      currency: order.currency,
      exchangeRate: order.exchangeRate.toString(),
      incoterm: order.incoterm,
      headerDiscount: headerDiscount.toFixed(2),
      notes: `Order ${order.orderNo}. Incoterm ${order.incoterm}${order.paymentTerms ? `. Payment terms: ${order.paymentTerms}` : ""}`,
      items,
    },
    userId,
  );
  return inv;
}

export async function issueInvoice(tx: Tx, invoiceId: string, userId: string) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new BusinessError("Invoice not found");
  if (inv.status !== "DRAFT") throw new BusinessError("Only draft invoices can be issued");
  await tx.invoice.update({ where: { id: invoiceId }, data: { status: deriveInvoiceStatus("ISSUED", inv.total, inv.amountPaid, inv.dueDate) as never } });
  await audit({ userId, action: "invoice.issue", entity: "Invoice", entityId: invoiceId, summary: `Issued ${inv.invoiceNo}` }, tx);
}

export async function cancelInvoice(tx: Tx, invoiceId: string, userId: string, reason: string) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { creditNotes: { where: { status: { not: "CANCELLED" } } } } });
  if (!inv) throw new BusinessError("Invoice not found");
  if (inv.status === "CANCELLED") throw new BusinessError("Invoice already cancelled");
  if (D(inv.amountPaid).gt(0)) throw new BusinessError("Invoice has payments or credits applied; reverse them or issue a credit note instead");
  await tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
  await tx.storageAdjustment.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
  if (inv.originalInvoiceId) await recalcInvoicePaid(tx, inv.originalInvoiceId);
  await audit({ userId, action: "invoice.cancel", entity: "Invoice", entityId: invoiceId, summary: reason }, tx);
}

/** Amount settled on an invoice = non-voided payment allocations + issued credit notes applied to it. */
export async function recalcInvoicePaid(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const alloc = await tx.paymentAllocation.aggregate({ where: { invoiceId, payment: { voidedAt: null } }, _sum: { amount: true } });
  const credits = await tx.invoice.aggregate({ where: { originalInvoiceId: invoiceId, type: "CREDIT_NOTE", status: { notIn: ["CANCELLED", "DRAFT"] } }, _sum: { total: true } });
  const paid = D(alloc._sum.amount).plus(D(credits._sum.total));
  if (paid.gt(D(inv.total))) throw new BusinessError(`Payments and credits (${paid.toFixed(2)}) would exceed invoice total (${D(inv.total).toFixed(2)})`);
  const status = deriveInvoiceStatus(inv.status === "OVERDUE" || inv.status === "PAID" || inv.status === "PARTIALLY_PAID" ? "ISSUED" : inv.status, inv.total, paid, inv.dueDate);
  await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid: paid.toFixed(2), status: status as never } });
}

export async function createCreditNote(tx: Tx, originalInvoiceId: string, amount: string | number, reason: string, userId: string) {
  const orig = await tx.invoice.findUnique({ where: { id: originalInvoiceId } });
  if (!orig) throw new BusinessError("Invoice not found");
  if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID"].includes(orig.status) || orig.type === "CREDIT_NOTE" || orig.type === "PRO_FORMA")
    throw new BusinessError("Credit notes can only be issued against issued sales, storage or purchase invoices");
  const amt = money(amount);
  const open = D(orig.total).minus(D(orig.amountPaid));
  if (amt.lte(0)) throw new BusinessError("Credit amount must be positive");
  if (amt.gt(open)) throw new BusinessError(`Credit amount exceeds the open balance (${open.toFixed(2)}). Refund paid amounts separately.`);
  const today = todayDate();
  const cn = await createInvoice(
    tx,
    {
      type: "CREDIT_NOTE",
      customerId: orig.customerId,
      supplierId: orig.supplierId,
      originalInvoiceId: orig.id,
      issueDate: today,
      dueDate: today,
      currency: orig.currency,
      exchangeRate: orig.exchangeRate.toString(),
      notes: `Credit against ${orig.invoiceNo}: ${reason}`,
      items: [{ description: `Credit: ${reason}`, quantity: 1, unit: "lot", unitPrice: amt.toFixed(2) }],
      issue: true,
    },
    userId,
  );
  await tx.invoice.update({ where: { id: cn.id }, data: { status: "PAID", amountPaid: amt.toFixed(2) } });
  await recalcInvoicePaid(tx, orig.id);
  return cn;
}

export interface PaymentInput {
  direction: PaymentDirection;
  customerId?: string | null;
  supplierId?: string | null;
  method: PaymentMethod;
  amount: string | number;
  currency: string;
  paidAt: Date;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey: string;
  allocations: { invoiceId: string; amount: string | number }[];
}

const RECEIVABLE: InvoiceType[] = ["SALES", "COLD_STORAGE", "PRO_FORMA"];

export async function recordPayment(tx: Tx, input: PaymentInput, userId: string | null) {
  const amount = money(input.amount);
  if (amount.lte(0)) throw new BusinessError("Payment amount must be greater than zero");
  if (input.direction === "INCOMING" && !input.customerId) throw new BusinessError("Select the paying customer");
  if (input.direction === "OUTGOING" && !input.supplierId) throw new BusinessError("Select the supplier being paid");
  const dup = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (dup) throw new BusinessError(`This payment was already recorded as ${dup.paymentNo}`);
  if (input.reference) {
    const sameRef = await tx.payment.findFirst({
      where: { reference: input.reference, method: input.method, voidedAt: null, customerId: input.customerId ?? undefined, supplierId: input.supplierId ?? undefined },
    });
    if (sameRef) throw new BusinessError(`A payment with reference "${input.reference}" already exists (${sameRef.paymentNo}). Duplicate prevented.`);
  }
  const allocs = input.allocations.filter((a) => D(a.amount).gt(0));
  const allocTotal = sum(allocs.map((a) => money(a.amount)));
  if (allocTotal.gt(amount)) throw new BusinessError("Allocated amount exceeds the payment amount");
  const ids = new Set<string>();
  for (const a of allocs) {
    if (ids.has(a.invoiceId)) throw new BusinessError("Each invoice can only be allocated once per payment");
    ids.add(a.invoiceId);
  }

  const paymentNo = await nextNumber(tx, input.direction === "INCOMING" ? "RCPT" : "PAY");
  const payment = await tx.payment.create({
    data: {
      paymentNo,
      direction: input.direction,
      customerId: input.customerId || null,
      supplierId: input.supplierId || null,
      method: input.method,
      amount: amount.toFixed(2),
      currency: input.currency,
      paidAt: input.paidAt,
      reference: input.reference || null,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      createdById: userId,
    },
  });
  for (const a of allocs) await allocate(tx, payment.id, a.invoiceId, a.amount);
  await audit({ userId, action: "payment.record", entity: "Payment", entityId: payment.id, summary: `${paymentNo} ${amount.toFixed(2)} ${input.currency}, allocated ${allocTotal.toFixed(2)}` }, tx);
  return payment;
}

/** Allocates (part of) a payment to an invoice. Validates party, currency, open balance and unallocated funds. */
export async function allocate(tx: Tx, paymentId: string, invoiceId: string, amountIn: string | number) {
  const amount = money(amountIn);
  if (amount.lte(0)) throw new BusinessError("Allocation must be positive");
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { allocations: true } });
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new BusinessError("Invoice not found");
  if (payment.voidedAt) throw new BusinessError("Payment is voided");
  if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status)) throw new BusinessError(`${inv.invoiceNo} is ${inv.status.toLowerCase()} and cannot receive payments`);
  if (payment.direction === "INCOMING" && (!RECEIVABLE.includes(inv.type) || inv.customerId !== payment.customerId))
    throw new BusinessError(`${inv.invoiceNo} does not belong to this customer`);
  if (payment.direction === "OUTGOING" && (inv.type !== "PURCHASE" || inv.supplierId !== payment.supplierId))
    throw new BusinessError(`${inv.invoiceNo} does not belong to this supplier`);
  if (inv.currency !== payment.currency) throw new BusinessError(`Currency mismatch: invoice in ${inv.currency}, payment in ${payment.currency}`);
  const unallocated = D(payment.amount).minus(sum(payment.allocations.map((a) => a.amount)));
  if (amount.gt(unallocated)) throw new BusinessError(`Only ${unallocated.toFixed(2)} of this payment is unallocated`);
  const open = D(inv.total).minus(D(inv.amountPaid));
  if (amount.gt(open)) throw new BusinessError(`Allocation ${amount.toFixed(2)} exceeds ${inv.invoiceNo} balance ${open.toFixed(2)}`);
  if (payment.allocations.some((a) => a.invoiceId === invoiceId)) {
    const existing = payment.allocations.find((a) => a.invoiceId === invoiceId)!;
    await tx.paymentAllocation.update({ where: { id: existing.id }, data: { amount: D(existing.amount).plus(amount).toFixed(2) } });
  } else {
    await tx.paymentAllocation.create({ data: { paymentId, invoiceId, amount: amount.toFixed(2) } });
  }
  await recalcInvoicePaid(tx, invoiceId);
  if (inv.customerId && RECEIVABLE.includes(inv.type)) {
    const refreshed = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (refreshed.status === "PAID") await tx.customer.update({ where: { id: inv.customerId }, data: { pipelineStage: "PAID" } }).catch(() => undefined);
  }
}

export async function voidPayment(tx: Tx, paymentId: string, userId: string, reason: string) {
  const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { allocations: true } });
  if (!p) throw new BusinessError("Payment not found");
  if (p.voidedAt) throw new BusinessError("Payment already voided");
  await tx.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidReason: reason } });
  for (const a of p.allocations) await recalcInvoicePaid(tx, a.invoiceId);
  await audit({ userId, action: "payment.void", entity: "Payment", entityId: paymentId, summary: reason }, tx);
}

export function unallocatedAmount(p: { amount: Decimal | string; allocations: { amount: Decimal | string }[] }) {
  return D(p.amount).minus(sum(p.allocations.map((a) => a.amount)));
}

/** Marks issued invoices past due as OVERDUE. */
export async function refreshOverdue(tx: Tx) {
  const today = todayDate();
  const res = await tx.invoice.updateMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: today } }, data: { status: "OVERDUE" } });
  return res.count;
}
