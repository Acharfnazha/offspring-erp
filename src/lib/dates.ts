// Calendar-date helpers. Business dates are handled as "YYYY-MM-DD" strings / UTC-midnight Date objects
// so that billing never shifts because of server or browser time zones.

export const BUSINESS_TZ = process.env.BUSINESS_TIMEZONE || "Asia/Beirut";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(s: string): Date {
  const m = ISO_RE.exec(s);
  if (!m) throw new Error(`Invalid date: ${s}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) throw new Error(`Invalid date: ${s}`);
  return dt;
}

/** Format a UTC-midnight date (as returned by Prisma for @db.Date) as YYYY-MM-DD. */
export function isoDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

/** Calendar date of an instant in the business time zone. */
export function businessDate(instant: Date = new Date(), tz: string = BUSINESS_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayDate(): Date {
  return parseDateOnly(businessDate());
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** Add calendar months to a date-only value, clamping the day (Jan 31 + 1 month = Feb 28/29). Always computed from the anchor. */
export function addMonthsClamped(anchor: Date, months: number): Date {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth() + months;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), daysInMonth(ty, tm));
  return new Date(Date.UTC(ty, tm, day));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatDate(d: Date | string | null | undefined, locale = "en-GB"): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(dt);
}

export function formatDateTime(d: Date | string | null | undefined, locale = "en-GB"): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: BUSINESS_TZ }).format(dt);
}

export type RangeKey = "today" | "7d" | "30d" | "month" | "year" | "custom";

/** Resolve dashboard/report date filters into [from, to] (inclusive, date-only) plus the previous comparable period. */
export function resolveRange(key: string | undefined, fromStr?: string, toStr?: string) {
  const today = todayDate();
  let from: Date;
  let to: Date = today;
  switch (key) {
    case "today":
      from = today;
      break;
    case "7d":
      from = addDays(today, -6);
      break;
    case "30d":
      from = addDays(today, -29);
      break;
    case "month":
      from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      break;
    case "custom":
      try {
        from = fromStr ? parseDateOnly(fromStr) : addDays(today, -29);
        to = toStr ? parseDateOnly(toStr) : today;
      } catch {
        from = addDays(today, -29);
      }
      if (from > to) [from, to] = [to, from];
      break;
    case "year":
    default:
      from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      key = key ?? "year";
  }
  const span = diffDays(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(span - 1));
  return { key: (key as RangeKey) ?? "year", from, to, prevFrom, prevTo, toExclusive: addDays(to, 1), prevToExclusive: from };
}
