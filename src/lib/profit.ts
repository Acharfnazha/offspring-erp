import { z } from "zod";
import { D, money, sum, Decimal } from "./money";

const num = z.coerce.number().finite().min(0);

export const packagingItemSchema = z.object({ name: z.string().min(1).max(80), costPerCarton: num });

export const profitInputSchema = z.object({
  variety: z.string().max(120).default(""),
  purchaseCostPerKg: num,
  totalKg: z.coerce.number().finite().positive(),
  cartonWeightKg: z.coerce.number().finite().positive().default(5),
  packagingItems: z.array(packagingItemSchema).default([]),
  packagingLaborPerCarton: num.default(0),
  sortingCostPerKg: num.default(0),
  refrigerationCost: num.default(0),
  inlandTransport: num.default(0),
  portHandling: num.default(0),
  customsCharges: num.default(0),
  freight: num.default(0),
  insurance: num.default(0),
  miscCosts: num.default(0),
  sellingPricePerKg: num,
  sellingCurrency: z.string().length(3).default("USD"),
  /** Units of selling currency per 1 USD (1 for USD). Costs are entered in USD. */
  exchangeRate: z.coerce.number().finite().positive().default(1),
  desiredMarginPct: z.coerce.number().finite().min(0).max(95).default(15),
});

export type ProfitInput = z.input<typeof profitInputSchema>;
export type ProfitInputParsed = z.output<typeof profitInputSchema>;

export interface ProfitResult {
  cartons: number;
  totalPurchaseCost: string;
  totalPackagingCost: string;
  packagingMaterials: string;
  packagingLabor: string;
  sortingCost: string;
  totalLogisticsCost: string;
  totalLandedCost: string;
  costPerKg: string;
  costPerCarton: string;
  revenueUSD: string;
  revenueSellingCurrency: string;
  grossProfit: string;
  grossMarginPct: string; // profit / revenue
  markupPct: string; // profit / cost
  breakEvenPricePerKg: string; // USD
  targetPricePerKg: string; // USD, achieves desired gross margin
  targetPricePerKgSellingCurrency: string;
}

export function calculateProfit(raw: ProfitInput): ProfitResult {
  const i = profitInputSchema.parse(raw);
  const kg = D(i.totalKg);
  const cartons = Math.ceil(kg.div(D(i.cartonWeightKg)).toNumber() - 1e-9);
  const purchase = money(kg.mul(D(i.purchaseCostPerKg)));
  const materialsPerCarton = sum(i.packagingItems.map((p) => p.costPerCarton));
  const packagingMaterials = money(materialsPerCarton.mul(cartons));
  const packagingLabor = money(D(i.packagingLaborPerCarton).mul(cartons));
  const packaging = packagingMaterials.plus(packagingLabor);
  const sorting = money(kg.mul(D(i.sortingCostPerKg)));
  const logistics = money(
    sum([i.refrigerationCost, i.inlandTransport, i.portHandling, i.customsCharges, i.freight, i.insurance, i.miscCosts]),
  );
  const landed = purchase.plus(packaging).plus(sorting).plus(logistics);
  const rate = D(i.exchangeRate);
  const revenueSell = money(kg.mul(D(i.sellingPricePerKg)));
  const revenueUSD = money(revenueSell.div(rate));
  const gp = revenueUSD.minus(landed);
  const margin = revenueUSD.gt(0) ? gp.div(revenueUSD).mul(100) : new Decimal(0);
  const markup = landed.gt(0) ? gp.div(landed).mul(100) : new Decimal(0);
  const costPerKg = landed.div(kg);
  const target = costPerKg.div(new Decimal(1).minus(D(i.desiredMarginPct).div(100)));
  return {
    cartons,
    totalPurchaseCost: purchase.toFixed(2),
    totalPackagingCost: packaging.toFixed(2),
    packagingMaterials: packagingMaterials.toFixed(2),
    packagingLabor: packagingLabor.toFixed(2),
    sortingCost: sorting.toFixed(2),
    totalLogisticsCost: logistics.toFixed(2),
    totalLandedCost: landed.toFixed(2),
    costPerKg: costPerKg.toFixed(4),
    costPerCarton: cartons > 0 ? landed.div(cartons).toFixed(2) : "0.00",
    revenueUSD: revenueUSD.toFixed(2),
    revenueSellingCurrency: revenueSell.toFixed(2),
    grossProfit: gp.toFixed(2),
    grossMarginPct: margin.toFixed(2),
    markupPct: markup.toFixed(2),
    breakEvenPricePerKg: costPerKg.toFixed(4),
    targetPricePerKg: target.toFixed(4),
    targetPricePerKgSellingCurrency: target.mul(rate).toFixed(4),
  };
}

export interface ScenarioDelta {
  purchasePct: number;
  freightPct: number;
  sellingPct: number;
}

export const DEFAULT_SCENARIOS: Record<"best" | "expected" | "worst", ScenarioDelta> = {
  best: { purchasePct: -5, freightPct: -10, sellingPct: 5 },
  expected: { purchasePct: 0, freightPct: 0, sellingPct: 0 },
  worst: { purchasePct: 10, freightPct: 20, sellingPct: -8 },
};

function adj(v: number, pctChange: number): number {
  return D(v).mul(D(100 + pctChange)).div(100).toNumber();
}

export function applyScenario(raw: ProfitInput, d: ScenarioDelta): ProfitInput {
  const i = profitInputSchema.parse(raw);
  return {
    ...i,
    purchaseCostPerKg: adj(i.purchaseCostPerKg, d.purchasePct),
    freight: adj(i.freight, d.freightPct),
    sellingPricePerKg: adj(i.sellingPricePerKg, d.sellingPct),
  };
}

export function sensitivity(raw: ProfitInput, steps = [-20, -10, 0, 10, 20]) {
  return steps.map((s) => ({
    change: s,
    freight: calculateProfit(applyScenario(raw, { purchasePct: 0, freightPct: s, sellingPct: 0 })).grossProfit,
    purchase: calculateProfit(applyScenario(raw, { purchasePct: s, freightPct: 0, sellingPct: 0 })).grossProfit,
    selling: calculateProfit(applyScenario(raw, { purchasePct: 0, freightPct: 0, sellingPct: s })).grossProfit,
  }));
}

export const GRAPE_PACKAGING_DEFAULTS = [
  { name: "Grape preservation sheet", costPerCarton: 0.2 },
  { name: "Carton packaging materials", costPerCarton: 0.2 },
  { name: "Protective absorbent pad", costPerCarton: 0.1 },
];

/** Sample reference purchase prices (USD/kg) — illustrative only, NOT live market prices. */
export const SAMPLE_REFERENCE_PRICES: Record<string, number> = {
  "Red Globe": 1.5,
  "Chili Black": 1.6,
  "Crimson Seedless": 1.725,
  "Scarlet Seedless": 1.75,
};
