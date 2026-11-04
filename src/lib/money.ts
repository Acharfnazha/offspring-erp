import Decimal from "decimal.js";

// Financial arithmetic uses decimal.js exclusively — never JS floating point.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
export type DecimalLike = Decimal | string | number | { toString(): string } | null | undefined;

export function D(v: DecimalLike): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  if (v instanceof Decimal) return v;
  return new Decimal(typeof v === "number" ? v : v.toString());
}

/** Round to cents (half-up). */
export function money(v: DecimalLike): Decimal {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sum(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0));
}

export function toFixed2(v: DecimalLike): string {
  return money(v).toFixed(2);
}

export function formatMoney(v: DecimalLike, currency = "USD", locale = "en-US"): string {
  const n = money(v);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      Number(n.toFixed(2)),
    );
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function formatKg(v: DecimalLike, locale = "en-US"): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(D(v).toFixed(1)))} kg`;
}

export function formatNumber(v: DecimalLike, digits = 0, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(D(v).toFixed(digits)));
}

export function pct(v: DecimalLike, digits = 1): string {
  return `${D(v).toFixed(digits)}%`;
}

/** Convert an amount in `currency` to USD using a rate expressed as units of currency per 1 USD. */
export function toUSD(amount: DecimalLike, ratePerUSD: DecimalLike): Decimal {
  const r = D(ratePerUSD);
  if (r.lte(0)) throw new Error("Exchange rate must be positive");
  return money(D(amount).div(r));
}

export function fromUSD(amountUSD: DecimalLike, ratePerUSD: DecimalLike): Decimal {
  const r = D(ratePerUSD);
  if (r.lte(0)) throw new Error("Exchange rate must be positive");
  return money(D(amountUSD).mul(r));
}
