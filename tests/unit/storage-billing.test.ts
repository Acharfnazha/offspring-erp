import { describe, expect, it } from "vitest";
import { billingPeriods, computeContractBilling, storageCharge } from "@/lib/storage-billing";
import { parseDateOnly as d, addMonthsClamped, businessDate } from "@/lib/dates";

const policy = { ratePerKgMonth: "0.05" };

describe("storage billing — default policy ($0.05/kg/billing month, started months count in full)", () => {
  it("10,000 kg for exactly 1 month = $500", () => {
    expect(storageCharge(10000, d("2026-01-10"), d("2026-02-10"), policy).toFixed(2)).toBe("500.00");
  });
  it("10,000 kg for 1 month and 1 day = $1,000", () => {
    expect(storageCharge(10000, d("2026-01-10"), d("2026-02-11"), policy).toFixed(2)).toBe("1000.00");
  });
  it("10,000 kg for 15 days = $500", () => {
    expect(storageCharge(10000, d("2026-03-01"), d("2026-03-16"), policy).toFixed(2)).toBe("500.00");
  });
  it("same-day entry/exit charges the configured minimum (default 1 period)", () => {
    expect(billingPeriods(d("2026-05-05"), d("2026-05-05"))).toBe(1);
    expect(billingPeriods(d("2026-05-05"), d("2026-05-05"), 0)).toBe(0);
  });
  it("handles month-end clamping (Jan 31 → Feb 28 is one month)", () => {
    expect(addMonthsClamped(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(billingPeriods(d("2026-01-31"), d("2026-02-28"))).toBe(1);
    expect(billingPeriods(d("2026-01-31"), d("2026-03-01"))).toBe(2);
    // anchored to the entry date, not chained: 2nd period ends Mar 31, not Mar 28
    expect(billingPeriods(d("2026-01-31"), d("2026-03-31"))).toBe(2);
    expect(billingPeriods(d("2026-01-31"), d("2026-04-01"))).toBe(3);
  });
  it("handles leap years", () => {
    expect(addMonthsClamped(d("2028-01-31"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(billingPeriods(d("2028-01-29"), d("2028-02-29"))).toBe(1);
    expect(billingPeriods(d("2028-02-29"), d("2029-02-28"))).toBe(12);
    expect(billingPeriods(d("2028-02-29"), d("2029-03-01"))).toBe(13);
  });
  it("crosses year boundaries", () => {
    expect(billingPeriods(d("2026-12-15"), d("2027-01-15"))).toBe(1);
    expect(billingPeriods(d("2026-12-15"), d("2027-03-20"))).toBe(4);
  });
  it("rejects exit before entry", () => {
    expect(() => billingPeriods(d("2026-02-01"), d("2026-01-31"))).toThrow();
  });
  it("bills staged removals per quantity according to its own storage period (FIFO)", () => {
    const r = computeContractBilling(
      [
        { type: "IN", quantityKg: 10000, date: d("2026-01-01") },
        { type: "OUT", quantityKg: 4000, date: d("2026-01-20") }, // 1 month
        { type: "OUT", quantityKg: 6000, date: d("2026-03-05") }, // 3 months
      ],
      policy,
      d("2026-06-01"),
    );
    expect(r.slices.map((s) => [s.quantityKg.toNumber(), s.periods, s.amount.toFixed(2)])).toEqual([
      [4000, 1, "200.00"],
      [6000, 3, "900.00"],
    ]);
    expect(r.total.toFixed(2)).toBe("1100.00");
    expect(r.onHandKg.toNumber()).toBe(0);
  });
  it("bills open quantity through the as-of date and consumes oldest layers first", () => {
    const r = computeContractBilling(
      [
        { type: "IN", quantityKg: 5000, date: d("2026-01-01") },
        { type: "IN", quantityKg: 5000, date: d("2026-02-15") },
        { type: "OUT", quantityKg: 7000, date: d("2026-02-20") },
      ],
      policy,
      d("2026-03-10"),
    );
    // 5000 from Jan 1→Feb 20 (2 months) = 500; 2000 from Feb 15→Feb 20 (1) = 100; 3000 open Feb15→Mar10 (1) = 150
    expect(r.total.toFixed(2)).toBe("750.00");
    expect(r.onHandKg.toNumber()).toBe(3000);
  });
  it("rejects removing more than stored", () => {
    expect(() =>
      computeContractBilling(
        [
          { type: "IN", quantityKg: 100, date: d("2026-01-01") },
          { type: "OUT", quantityKg: 101, date: d("2026-01-02") },
        ],
        policy,
        d("2026-01-03"),
      ),
    ).toThrow(/exceeds/);
  });
  it("supports a configurable rate", () => {
    expect(storageCharge(1000, d("2026-01-01"), d("2026-02-02"), { ratePerKgMonth: "0.0725" }).toFixed(2)).toBe("145.00");
  });
  it("derives business dates in the configured time zone", () => {
    // 2026-03-31 22:30 UTC is already April 1st in Beirut (UTC+3 in summer time)
    expect(businessDate(new Date("2026-03-31T22:30:00Z"), "Asia/Beirut")).toBe("2026-04-01");
    expect(businessDate(new Date("2026-03-31T22:30:00Z"), "UTC")).toBe("2026-03-31");
  });
});
