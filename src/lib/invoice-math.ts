import { D, money, sum, type DecimalLike, Decimal } from "./money";

export interface LineInput {
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  discountPct?: DecimalLike;
  taxPct?: DecimalLike;
}

export interface LineResult {
  gross: Decimal;
  discount: Decimal;
  net: Decimal;
  tax: Decimal;
  total: Decimal;
}

export function computeLine(l: LineInput): LineResult {
  const qty = D(l.quantity);
  const price = D(l.unitPrice);
  if (qty.lt(0)) throw new Error("Quantity cannot be negative");
  if (price.lt(0)) throw new Error("Unit price cannot be negative");
  const discPct = D(l.discountPct);
  const taxPct = D(l.taxPct);
  if (discPct.lt(0) || discPct.gt(100)) throw new Error("Discount must be between 0 and 100%");
  if (taxPct.lt(0) || taxPct.gt(100)) throw new Error("Tax must be between 0 and 100%");
  const gross = money(qty.mul(price));
  const discount = money(gross.mul(discPct).div(100));
  const net = gross.minus(discount);
  const tax = money(net.mul(taxPct).div(100));
  return { gross, discount, net, tax, total: net.plus(tax) };
}

export interface DocumentTotals {
  subtotal: Decimal; // sum of gross
  discountTotal: Decimal; // line discounts + header discount
  taxTotal: Decimal;
  total: Decimal;
  lines: LineResult[];
}

/** Totals for an invoice/quote/order. Header discount is a fixed amount applied after line discounts, before tax is NOT re-derived. */
export function computeTotals(lines: LineInput[], headerDiscount: DecimalLike = 0): DocumentTotals {
  const results = lines.map(computeLine);
  const subtotal = sum(results.map((r) => r.gross));
  const lineDiscounts = sum(results.map((r) => r.discount));
  const taxTotal = sum(results.map((r) => r.tax));
  const hd = money(headerDiscount);
  if (hd.lt(0)) throw new Error("Discount cannot be negative");
  const netBeforeHeader = subtotal.minus(lineDiscounts);
  if (hd.gt(netBeforeHeader)) throw new Error("Discount cannot exceed the net amount");
  const discountTotal = lineDiscounts.plus(hd);
  const total = money(subtotal.minus(discountTotal).plus(taxTotal));
  return { subtotal, discountTotal, taxTotal, total, lines: results };
}

export function balanceDue(total: DecimalLike, paid: DecimalLike): Decimal {
  const b = money(D(total).minus(D(paid)));
  return b.lt(0) ? new Decimal(0) : b;
}

/** Derive invoice status from amounts and due date (does not touch DRAFT/CANCELLED). */
export function deriveInvoiceStatus(
  current: string,
  total: DecimalLike,
  paid: DecimalLike,
  dueDate: Date,
  today: Date = new Date(),
): string {
  if (current === "DRAFT" || current === "CANCELLED") return current;
  const t = D(total);
  const p = D(paid);
  if (p.gte(t) && t.gt(0)) return "PAID";
  const dueStr = dueDate.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  if (todayStr > dueStr) return "OVERDUE";
  if (p.gt(0)) return "PARTIALLY_PAID";
  return "ISSUED";
}
