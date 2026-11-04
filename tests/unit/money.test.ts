import { describe, expect, it } from "vitest";
import { D, money, sum, toUSD, fromUSD, formatMoney } from "@/lib/money";
import { computeLine, computeTotals, balanceDue, deriveInvoiceStatus } from "@/lib/invoice-math";
import { parseDateOnly } from "@/lib/dates";

describe("decimal money arithmetic", () => {
  it("avoids floating-point errors", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sum([0.1, 0.2]).toString()).toBe("0.3");
    expect(money("1.005").toFixed(2)).toBe("1.01");
  });
  it("converts currencies with a positive rate", () => {
    expect(toUSD("367.25", "3.6725").toFixed(2)).toBe("100.00");
    expect(fromUSD("100", "3.75").toFixed(2)).toBe("375.00");
    expect(() => toUSD(1, 0)).toThrow();
  });
  it("formats currency", () => {
    expect(formatMoney("1234.5")).toBe("$1,234.50");
  });
});

describe("invoice, discount and tax arithmetic", () => {
  it("applies line discount before tax", () => {
    const l = computeLine({ quantity: 1000, unitPrice: "1.25", discountPct: 10, taxPct: 11 });
    expect(l.gross.toFixed(2)).toBe("1250.00");
    expect(l.discount.toFixed(2)).toBe("125.00");
    expect(l.tax.toFixed(2)).toBe("123.75");
    expect(l.total.toFixed(2)).toBe("1248.75");
  });
  it("totals multiple lines with header discount", () => {
    const t = computeTotals(
      [
        { quantity: 20000, unitPrice: "1.10" },
        { quantity: 5000, unitPrice: "2.35", discountPct: 5 },
      ],
      "500",
    );
    expect(t.subtotal.toFixed(2)).toBe("33750.00");
    expect(t.discountTotal.toFixed(2)).toBe("1087.50");
    expect(t.total.toFixed(2)).toBe("32662.50");
  });
  it("rejects invalid values", () => {
    expect(() => computeLine({ quantity: -1, unitPrice: 1 })).toThrow();
    expect(() => computeLine({ quantity: 1, unitPrice: 1, discountPct: 120 })).toThrow();
    expect(() => computeTotals([{ quantity: 1, unitPrice: 10 }], 11)).toThrow();
  });
  it("computes balances and statuses", () => {
    expect(balanceDue("1000", "400").toFixed(2)).toBe("600.00");
    expect(balanceDue("1000", "1000").toFixed(2)).toBe("0.00");
    const due = parseDateOnly("2026-06-30");
    expect(deriveInvoiceStatus("ISSUED", 1000, 0, due, parseDateOnly("2026-06-01"))).toBe("ISSUED");
    expect(deriveInvoiceStatus("ISSUED", 1000, 400, due, parseDateOnly("2026-06-01"))).toBe("PARTIALLY_PAID");
    expect(deriveInvoiceStatus("ISSUED", 1000, 1000, due, parseDateOnly("2026-07-15"))).toBe("PAID");
    expect(deriveInvoiceStatus("ISSUED", 1000, 400, due, parseDateOnly("2026-07-01"))).toBe("OVERDUE");
    expect(deriveInvoiceStatus("DRAFT", 1000, 0, due)).toBe("DRAFT");
  });
  it("D() handles null and strings", () => {
    expect(D(null).toNumber()).toBe(0);
    expect(D("12.345").toFixed(3)).toBe("12.345");
  });
});
