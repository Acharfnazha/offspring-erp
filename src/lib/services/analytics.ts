import { prisma } from "@/lib/db";
import { D, sum, Decimal } from "@/lib/money";
import { addDays, todayDate } from "@/lib/dates";

/*
 * Reporting model (consistent across dashboard, analytics and the assistant):
 *  Revenue        = issued SALES + COLD_STORAGE invoices (by issue date, USD-equivalent) − customer CREDIT NOTES
 *  COGS           = inventory cost of goods dispatched (DISPATCH movements × batch cost/kg)
 *  Logistics      = shipment freight + insurance + documentation + customs (by departure / ETD date)
 *  Opex           = APPROVED/PAID expenses, excluding FRUIT_PURCHASES (inventory cost is already in COGS)
 *  Gross profit   = Revenue − COGS
 *  Net profit     = Revenue − COGS − Logistics − Opex   (operational view, not statutory accounts)
 */

const REVENUE_TYPES = `('SALES','COLD_STORAGE')`;
const LIVE = `('ISSUED','PARTIALLY_PAID','PAID','OVERDUE')`;

type Num = { v: string | null };
const n = (rows: Num[]) => D(rows[0]?.v);

export async function revenue(from: Date, toExcl: Date) {
  const r = await prisma.$queryRawUnsafe<Num[]>(
    `SELECT SUM(CASE WHEN type='CREDIT_NOTE' THEN -total ELSE total END / NULLIF("exchangeRate",0))::text v FROM "Invoice"
     WHERE (type IN ${REVENUE_TYPES} OR (type='CREDIT_NOTE' AND "customerId" IS NOT NULL)) AND status IN ${LIVE} AND "issueDate" >= $1 AND "issueDate" < $2`,
    from,
    toExcl,
  );
  return n(r);
}

export async function cogs(from: Date, toExcl: Date) {
  const r = await prisma.$queryRawUnsafe<Num[]>(
    `SELECT SUM(m."quantityKg" * b."costPerKg")::text v FROM "InventoryMovement" m JOIN "InventoryBatch" b ON b.id = m."batchId"
     WHERE m.type='DISPATCH' AND m."createdAt" >= $1 AND m."createdAt" < $2`,
    from,
    toExcl,
  );
  return n(r);
}

export async function logisticsCost(from: Date, toExcl: Date) {
  const r = await prisma.$queryRawUnsafe<Num[]>(
    `SELECT SUM("freightCost"+"insuranceCost"+"documentationCost"+"customsCost")::text v FROM "Shipment"
     WHERE status <> 'CANCELLED' AND COALESCE(atd, etd, "createdAt"::date) >= $1 AND COALESCE(atd, etd, "createdAt"::date) < $2`,
    from,
    toExcl,
  );
  return n(r);
}

export async function opex(from: Date, toExcl: Date) {
  const r = await prisma.$queryRawUnsafe<Num[]>(
    `SELECT SUM(amount)::text v FROM "Expense" WHERE status IN ('APPROVED','PAID') AND "archivedAt" IS NULL AND category <> 'FRUIT_PURCHASES' AND date >= $1 AND date < $2`,
    from,
    toExcl,
  );
  return n(r);
}

export async function profitAndLoss(from: Date, toExcl: Date) {
  const [rev, cg, lg, ox] = await Promise.all([revenue(from, toExcl), cogs(from, toExcl), logisticsCost(from, toExcl), opex(from, toExcl)]);
  const gross = rev.minus(cg);
  const net = gross.minus(lg).minus(ox);
  return { revenue: rev, cogs: cg, logistics: lg, opex: ox, grossProfit: gross, netProfit: net, grossMarginPct: rev.gt(0) ? gross.div(rev).mul(100) : new Decimal(0) };
}

export async function receivables() {
  const r = await prisma.$queryRawUnsafe<{ v: string | null; c: bigint }[]>(
    `SELECT SUM(total-"amountPaid")::text v, COUNT(*) c FROM "Invoice" WHERE type IN ${REVENUE_TYPES} AND status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')`,
  );
  return { amount: D(r[0]?.v), count: Number(r[0]?.c ?? 0) };
}

export async function payables() {
  const r = await prisma.$queryRawUnsafe<{ v: string | null; c: bigint }[]>(
    `SELECT SUM(total-"amountPaid")::text v, COUNT(*) c FROM "Invoice" WHERE type='PURCHASE' AND status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')`,
  );
  return { amount: D(r[0]?.v), count: Number(r[0]?.c ?? 0) };
}

export async function inventoryTotals() {
  const r = await prisma.$queryRawUnsafe<{ kg: string | null; value: string | null; reserved: string | null }[]>(
    `SELECT SUM("onHandKg")::text kg, SUM("onHandKg"*"costPerKg")::text value, SUM("reservedKg")::text reserved FROM "InventoryBatch" WHERE "onHandKg" > 0`,
  );
  return { kg: D(r[0]?.kg), value: D(r[0]?.value), reserved: D(r[0]?.reserved) };
}

export async function roomUtilization() {
  const rows = await prisma.$queryRawUnsafe<{ id: string; code: string; name: string; capacity: string; status: string; inv: string | null; stored: string | null }[]>(
    `SELECT r.id, r.code, r.name, r."capacityKg"::text capacity, r.status::text,
       (SELECT SUM(b."onHandKg") FROM "InventoryBatch" b WHERE b."coldRoomId" = r.id)::text inv,
       (SELECT SUM(CASE WHEN m.type='IN' THEN m."quantityKg" ELSE -m."quantityKg" END) FROM "StorageMovement" m JOIN "StorageContract" c ON c.id=m."contractId" WHERE c."coldRoomId"=r.id AND c.status <> 'CANCELLED')::text stored
     FROM "ColdRoom" r ORDER BY r.code`,
  );
  return rows.map((r) => {
    const occupied = D(r.inv).plus(D(r.stored));
    const cap = D(r.capacity);
    return { id: r.id, code: r.code, name: r.name, status: r.status, capacityKg: cap, ownKg: D(r.inv), customerKg: D(r.stored), occupiedKg: occupied, availableKg: Decimal.max(cap.minus(occupied), 0), pct: cap.gt(0) ? occupied.div(cap).mul(100) : new Decimal(0) };
  });
}

export async function monthlySeries(months = 12) {
  const today = todayDate();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1));
  const q = <T,>(sql: string) => prisma.$queryRawUnsafe<T[]>(sql, start);
  const [rev, cg, lg, ox, col] = await Promise.all([
    q<{ m: Date; v: string }>(`SELECT date_trunc('month',"issueDate") m, SUM(CASE WHEN type='CREDIT_NOTE' THEN -total ELSE total END / NULLIF("exchangeRate",0))::text v FROM "Invoice" WHERE (type IN ${REVENUE_TYPES} OR (type='CREDIT_NOTE' AND "customerId" IS NOT NULL)) AND status IN ${LIVE} AND "issueDate" >= $1 GROUP BY 1`),
    q<{ m: Date; v: string }>(`SELECT date_trunc('month',m."createdAt") m, SUM(m."quantityKg"*b."costPerKg")::text v FROM "InventoryMovement" m JOIN "InventoryBatch" b ON b.id=m."batchId" WHERE m.type='DISPATCH' AND m."createdAt" >= $1 GROUP BY 1`),
    q<{ m: Date; v: string }>(`SELECT date_trunc('month',COALESCE(atd,etd,"createdAt"::date)) m, SUM("freightCost"+"insuranceCost"+"documentationCost"+"customsCost")::text v FROM "Shipment" WHERE status <> 'CANCELLED' AND COALESCE(atd,etd,"createdAt"::date) >= $1 GROUP BY 1`),
    q<{ m: Date; v: string }>(`SELECT date_trunc('month',date) m, SUM(amount)::text v FROM "Expense" WHERE status IN ('APPROVED','PAID') AND "archivedAt" IS NULL AND category <> 'FRUIT_PURCHASES' AND date >= $1 GROUP BY 1`),
    q<{ m: Date; v: string }>(`SELECT date_trunc('month',"paidAt") m, SUM(amount)::text v FROM "Payment" WHERE direction='INCOMING' AND "voidedAt" IS NULL AND "paidAt" >= $1 GROUP BY 1`),
  ]);
  const key = (d: Date) => new Date(d).toISOString().slice(0, 7);
  const map = (rows: { m: Date; v: string }[]) => new Map(rows.map((r) => [key(r.m), D(r.v)]));
  const [R, C, L, O, P] = [map(rev), map(cg), map(lg), map(ox), map(col)];
  const out = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const k = key(d);
    const revenueV = R.get(k) ?? new Decimal(0);
    const expensesV = (C.get(k) ?? new Decimal(0)).plus(L.get(k) ?? 0).plus(O.get(k) ?? 0);
    out.push({
      month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      revenue: Number(revenueV.toFixed(2)),
      expenses: Number(expensesV.toFixed(2)),
      cogs: Number((C.get(k) ?? new Decimal(0)).toFixed(2)),
      profit: Number(revenueV.minus(expensesV).toFixed(2)),
      collected: Number((P.get(k) ?? new Decimal(0)).toFixed(2)),
    });
  }
  return out;
}

export async function salesByCountry(from: Date, toExcl: Date) {
  const rows = await prisma.$queryRawUnsafe<{ k: string; v: string }[]>(
    `SELECT c.country k, SUM(CASE WHEN i.type='CREDIT_NOTE' THEN -i.total ELSE i.total END / NULLIF(i."exchangeRate",0))::text v FROM "Invoice" i JOIN "Customer" c ON c.id=i."customerId"
     WHERE (i.type IN ${REVENUE_TYPES} OR i.type='CREDIT_NOTE') AND i.status IN ${LIVE} AND i."issueDate" >= $1 AND i."issueDate" < $2 GROUP BY 1 ORDER BY 2 DESC`,
    from,
    toExcl,
  );
  return rows.map((r) => ({ name: r.k, value: Number(D(r.v).toFixed(2)) }));
}

/** Sales (dispatched value) & gross profit by product variety for orders dated within the range. */
export async function salesByProduct(from: Date, toExcl: Date) {
  const rows = await prisma.$queryRawUnsafe<{ k: string; p: string; kg: string; v: string; cogs: string }[]>(
    `SELECT v.name k, p.name p, SUM(oi."fulfilledKg")::text kg,
            SUM(oi."fulfilledKg"*oi."unitPrice"*(1-oi."discountPct"/100) / NULLIF(o."exchangeRate",0))::text v, SUM(oi."cogsAmount")::text cogs
     FROM "OrderItem" oi JOIN "SalesOrder" o ON o.id=oi."orderId" JOIN "ProductVariety" v ON v.id=oi."varietyId" JOIN "Product" p ON p.id=v."productId"
     WHERE o.status NOT IN ('DRAFT','CANCELLED') AND o."orderDate" >= $1 AND o."orderDate" < $2 AND oi."fulfilledKg" > 0 GROUP BY 1,2 ORDER BY 4 DESC`,
    from,
    toExcl,
  );
  return rows.map((r) => ({ name: r.k, product: r.p, kg: Number(D(r.kg).toFixed(1)), value: Number(D(r.v).toFixed(2)), cogs: Number(D(r.cogs).toFixed(2)), profit: Number(D(r.v).minus(D(r.cogs)).toFixed(2)) }));
}

export async function profitByCustomer(from: Date, toExcl: Date) {
  const rows = await prisma.$queryRawUnsafe<{ id: string; k: string; country: string; kg: string; v: string; cogs: string }[]>(
    `SELECT c.id, c."companyName" k, c.country, SUM(oi."fulfilledKg")::text kg, SUM(oi."fulfilledKg"*oi."unitPrice"*(1-oi."discountPct"/100) / NULLIF(o."exchangeRate",0))::text v, SUM(oi."cogsAmount")::text cogs
     FROM "OrderItem" oi JOIN "SalesOrder" o ON o.id=oi."orderId" JOIN "Customer" c ON c.id=o."customerId"
     WHERE o.status NOT IN ('DRAFT','CANCELLED') AND o."orderDate" >= $1 AND o."orderDate" < $2 AND oi."fulfilledKg" > 0 GROUP BY 1,2,3 ORDER BY 5 DESC`,
    from,
    toExcl,
  );
  return rows.map((r) => {
    const v = D(r.v), cg = D(r.cogs);
    return { id: r.id, name: r.k, country: r.country, kg: Number(D(r.kg).toFixed(1)), revenue: Number(v.toFixed(2)), cogs: Number(cg.toFixed(2)), profit: Number(v.minus(cg).toFixed(2)), marginPct: v.gt(0) ? Number(v.minus(cg).div(v).mul(100).toFixed(1)) : 0 };
  });
}

export async function profitByCountry(from: Date, toExcl: Date) {
  const rows = await profitByCustomer(from, toExcl);
  const m = new Map<string, { name: string; kg: number; revenue: Decimal; cogs: Decimal }>();
  for (const r of rows) {
    const e = m.get(r.country) ?? { name: r.country, kg: 0, revenue: new Decimal(0), cogs: new Decimal(0) };
    e.kg += r.kg; e.revenue = e.revenue.plus(r.revenue); e.cogs = e.cogs.plus(r.cogs);
    m.set(r.country, e);
  }
  return [...m.values()].map((e) => ({ name: e.name, kg: Number(e.kg.toFixed(1)), revenue: Number(e.revenue.toFixed(2)), cogs: Number(e.cogs.toFixed(2)), profit: Number(e.revenue.minus(e.cogs).toFixed(2)), marginPct: e.revenue.gt(0) ? Number(e.revenue.minus(e.cogs).div(e.revenue).mul(100).toFixed(1)) : 0 })).sort((a, b) => b.revenue - a.revenue);
}

export async function inventoryByVariety() {
  const rows = await prisma.$queryRawUnsafe<{ k: string; kg: string; reserved: string; value: string }[]>(
    `SELECT v.name k, SUM(b."onHandKg")::text kg, SUM(b."reservedKg")::text reserved, SUM(b."onHandKg"*b."costPerKg")::text value FROM "InventoryBatch" b JOIN "ProductVariety" v ON v.id=b."varietyId" WHERE b."onHandKg" > 0 GROUP BY 1 ORDER BY 2::numeric DESC`,
  );
  return rows.map((r) => ({ name: r.k, kg: Number(D(r.kg).toFixed(1)), reserved: Number(D(r.reserved).toFixed(1)), available: Number(D(r.kg).minus(D(r.reserved)).toFixed(1)), value: Number(D(r.value).toFixed(2)) }));
}

export async function receivablesAging() {
  const today = todayDate();
  const invs = await prisma.invoice.findMany({ where: { type: { in: ["SALES", "COLD_STORAGE"] }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { customer: true } });
  const buckets = { current: new Decimal(0), d1_30: new Decimal(0), d31_60: new Decimal(0), d61_90: new Decimal(0), d90p: new Decimal(0) };
  const byCustomer = new Map<string, { id: string; name: string; current: Decimal; d1_30: Decimal; d31_60: Decimal; d61_90: Decimal; d90p: Decimal; total: Decimal }>();
  for (const i of invs) {
    const bal = D(i.total).minus(D(i.amountPaid));
    const days = Math.floor((today.getTime() - i.dueDate.getTime()) / 86400000);
    const k = days <= 0 ? "current" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "d90p";
    buckets[k] = buckets[k].plus(bal);
    const c = byCustomer.get(i.customerId!) ?? { id: i.customerId!, name: i.customer?.companyName ?? "", current: new Decimal(0), d1_30: new Decimal(0), d31_60: new Decimal(0), d61_90: new Decimal(0), d90p: new Decimal(0), total: new Decimal(0) };
    c[k] = c[k].plus(bal);
    c.total = c.total.plus(bal);
    byCustomer.set(i.customerId!, c);
  }
  return { buckets, rows: [...byCustomer.values()].sort((a, b) => b.total.cmp(a.total)) };
}

export async function inventoryTurnover(from: Date, toExcl: Date) {
  const cg = await cogs(from, toExcl);
  const inv = await inventoryTotals();
  const days = Math.max(1, Math.round((toExcl.getTime() - from.getTime()) / 86400000));
  const turnover = inv.value.gt(0) ? cg.div(inv.value) : new Decimal(0);
  return { cogs: cg, inventoryValue: inv.value, turnover, daysOnHand: turnover.gt(0) ? new Decimal(days).div(turnover) : null, days };
}

export async function shipmentPerformance(from: Date, toExcl: Date) {
  const ships = await prisma.shipment.findMany({ where: { createdAt: { gte: from, lt: toExcl }, status: { not: "CANCELLED" } } });
  let onTime = 0, late = 0, measured = 0, transitDays = 0, transitN = 0;
  for (const s of ships) {
    if (s.ata && s.eta) { measured++; if (s.ata <= s.eta) onTime++; else late++; }
    if (s.ata && s.atd) { transitDays += (s.ata.getTime() - s.atd.getTime()) / 86400000; transitN++; }
  }
  const byStatus = new Map<string, number>();
  for (const s of ships) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
  return {
    total: ships.length, measured, onTime, late, onTimePct: measured ? (onTime / measured) * 100 : null, avgTransitDays: transitN ? transitDays / transitN : null,
    logisticsCost: sum(ships.map((s) => D(s.freightCost).plus(s.insuranceCost).plus(s.documentationCost).plus(s.customsCost))),
    byStatus: [...byStatus.entries()].map(([name, value]) => ({ name, value })),
  };
}

export async function storageRevenue(from: Date, toExcl: Date) {
  const r = await prisma.$queryRawUnsafe<Num[]>(`SELECT SUM(total)::text v FROM "Invoice" WHERE type='COLD_STORAGE' AND status IN ${LIVE} AND "issueDate" >= $1 AND "issueDate" < $2`, from, toExcl);
  return n(r);
}

export async function expensesByCategory(from: Date, toExcl: Date) {
  const rows = await prisma.$queryRawUnsafe<{ k: string; v: string }[]>(`SELECT category::text k, SUM(amount)::text v FROM "Expense" WHERE status IN ('APPROVED','PAID') AND "archivedAt" IS NULL AND date >= $1 AND date < $2 GROUP BY 1 ORDER BY 2::numeric DESC`, from, toExcl);
  return rows.map((r) => ({ name: r.k, value: Number(D(r.v).toFixed(2)) }));
}

export async function expiringSoon(days = 7) {
  return prisma.inventoryBatch.findMany({ where: { onHandKg: { gt: 0 }, expiryDate: { lte: addDays(todayDate(), days) } }, include: { variety: true }, orderBy: { expiryDate: "asc" }, take: 10 });
}
