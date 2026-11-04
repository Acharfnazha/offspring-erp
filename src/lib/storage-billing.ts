import { addMonthsClamped, isoDate } from "./dates";
import { D, money, sum, Decimal, type DecimalLike } from "./money";

/**
 * Cold-storage billing policy.
 * Default: rate per kg per billing month; consecutive monthly periods start at the entry date;
 * any positive partial period counts as a full period; same-day entry/exit is charged `minimumPeriods`.
 */
export interface BillingPolicy {
  ratePerKgMonth: DecimalLike;
  minimumPeriods?: number; // default 1
}

export const DEFAULT_STORAGE_RATE = "0.05";

/** Number of billing months between two calendar dates (UTC-midnight Date objects). */
export function billingPeriods(entry: Date, exit: Date, minimumPeriods = 1): number {
  if (exit.getTime() < entry.getTime()) throw new Error("Exit date cannot be before entry date");
  if (exit.getTime() === entry.getTime()) return Math.max(minimumPeriods, 0);
  let k = 1;
  while (addMonthsClamped(entry, k).getTime() < exit.getTime()) k++;
  return Math.max(k, minimumPeriods);
}

export function storageCharge(quantityKg: DecimalLike, entry: Date, exit: Date, policy: BillingPolicy): Decimal {
  const periods = billingPeriods(entry, exit, policy.minimumPeriods ?? 1);
  return money(D(quantityKg).mul(D(policy.ratePerKgMonth)).mul(periods));
}

export interface StorageMovementInput {
  type: "IN" | "OUT";
  quantityKg: DecimalLike;
  date: Date;
}

export interface StorageSlice {
  quantityKg: Decimal;
  entryDate: string;
  exitDate: string;
  periods: number;
  open: boolean;
  amount: Decimal;
}

export interface StorageBillingResult {
  slices: StorageSlice[];
  total: Decimal;
  onHandKg: Decimal;
  billedThrough: string;
}

/**
 * Bills a contract with staged entries/removals. Removals consume the oldest entries first (FIFO),
 * so every kilogram is charged according to its own actual storage period.
 * Quantities still in storage are billed through `asOf` (inclusive calendar date).
 */
export function computeContractBilling(movements: StorageMovementInput[], policy: BillingPolicy, asOf: Date): StorageBillingResult {
  const sorted = [...movements].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.type === "IN" ? -1 : 1));
  const layers: { qty: Decimal; date: Date }[] = [];
  const slices: StorageSlice[] = [];
  const minP = policy.minimumPeriods ?? 1;

  for (const m of sorted) {
    const qty = D(m.quantityKg);
    if (qty.lte(0)) throw new Error("Storage movement quantity must be positive");
    if (m.type === "IN") {
      layers.push({ qty, date: m.date });
      continue;
    }
    let remaining = qty;
    const available = sum(layers.map((l) => l.qty));
    if (remaining.gt(available)) throw new Error(`Removal of ${qty.toString()} kg on ${isoDate(m.date)} exceeds stored quantity (${available.toString()} kg)`);
    while (remaining.gt(0)) {
      const layer = layers[0];
      const take = Decimal.min(layer.qty, remaining);
      const periods = billingPeriods(layer.date, m.date, minP);
      slices.push({
        quantityKg: take,
        entryDate: isoDate(layer.date),
        exitDate: isoDate(m.date),
        periods,
        open: false,
        amount: money(take.mul(D(policy.ratePerKgMonth)).mul(periods)),
      });
      layer.qty = layer.qty.minus(take);
      remaining = remaining.minus(take);
      if (layer.qty.lte(0)) layers.shift();
    }
  }

  for (const layer of layers) {
    if (asOf.getTime() < layer.date.getTime()) continue; // not yet entered as of billing date
    const periods = billingPeriods(layer.date, asOf, minP);
    slices.push({
      quantityKg: layer.qty,
      entryDate: isoDate(layer.date),
      exitDate: isoDate(asOf),
      periods,
      open: true,
      amount: money(layer.qty.mul(D(policy.ratePerKgMonth)).mul(periods)),
    });
  }

  return {
    slices,
    total: sum(slices.map((s) => s.amount)),
    onHandKg: sum(layers.map((l) => l.qty)),
    billedThrough: isoDate(asOf),
  };
}
