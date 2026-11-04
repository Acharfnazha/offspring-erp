import { describe, expect, it } from "vitest";
import { calculateProfit, applyScenario, DEFAULT_SCENARIOS, sensitivity, GRAPE_PACKAGING_DEFAULTS } from "@/lib/profit";

const base = {
  variety: "Red Globe",
  purchaseCostPerKg: 1.5,
  totalKg: 20000,
  cartonWeightKg: 5,
  packagingItems: GRAPE_PACKAGING_DEFAULTS,
  packagingLaborPerCarton: 0.15,
  sortingCostPerKg: 0.02,
  refrigerationCost: 400,
  inlandTransport: 600,
  portHandling: 350,
  customsCharges: 250,
  freight: 3200,
  insurance: 150,
  miscCosts: 100,
  sellingPricePerKg: 2.4,
  desiredMarginPct: 20,
};

describe("profit calculator", () => {
  it("computes landed cost, margin and markup", () => {
    const r = calculateProfit(base);
    expect(r.cartons).toBe(4000);
    expect(r.totalPurchaseCost).toBe("30000.00");
    expect(r.packagingMaterials).toBe("2000.00"); // 4000 × 0.50
    expect(r.packagingLabor).toBe("600.00");
    expect(r.totalPackagingCost).toBe("2600.00");
    expect(r.sortingCost).toBe("400.00");
    expect(r.totalLogisticsCost).toBe("5050.00");
    expect(r.totalLandedCost).toBe("38050.00");
    expect(r.costPerKg).toBe("1.9025");
    expect(r.costPerCarton).toBe("9.51");
    expect(r.revenueUSD).toBe("48000.00");
    expect(r.grossProfit).toBe("9950.00");
    expect(r.grossMarginPct).toBe("20.73"); // 9950/48000
    expect(r.markupPct).toBe("26.15"); // 9950/38050
    expect(r.breakEvenPricePerKg).toBe("1.9025");
    expect(r.targetPricePerKg).toBe("2.3781"); // 1.9025 / 0.8
  });
  it("gross margin differs from markup", () => {
    const r = calculateProfit(base);
    expect(Number(r.markupPct)).toBeGreaterThan(Number(r.grossMarginPct));
  });
  it("rounds cartons up for partial cartons", () => {
    expect(calculateProfit({ ...base, totalKg: 1001, cartonWeightKg: 4.5 }).cartons).toBe(223);
  });
  it("converts selling currency to USD", () => {
    const r = calculateProfit({ ...base, sellingCurrency: "AED", exchangeRate: 3.6725, sellingPricePerKg: 8.814 });
    expect(r.revenueSellingCurrency).toBe("176280.00");
    expect(r.revenueUSD).toBe("48000.00");
  });
  it("supports scenario comparisons", () => {
    const best = calculateProfit(applyScenario(base, DEFAULT_SCENARIOS.best));
    const worst = calculateProfit(applyScenario(base, DEFAULT_SCENARIOS.worst));
    expect(Number(best.grossProfit)).toBeGreaterThan(9950);
    expect(Number(worst.grossProfit)).toBeLessThan(9950);
  });
  it("sensitivity: +10% freight reduces profit by 320", () => {
    const rows = sensitivity(base);
    const plus10 = rows.find((r) => r.change === 10)!;
    expect(plus10.freight).toBe("9630.00");
    expect(plus10.selling).toBe("14750.00");
  });
  it("rejects invalid inputs", () => {
    expect(() => calculateProfit({ ...base, totalKg: 0 })).toThrow();
    expect(() => calculateProfit({ ...base, purchaseCostPerKg: -1 })).toThrow();
  });
});
