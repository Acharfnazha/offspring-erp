import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { D, formatKg, formatMoney } from "@/lib/money";
import { addDays, isoDate, resolveRange, todayDate } from "@/lib/dates";
import { calculateProfit, applyScenario, DEFAULT_SCENARIOS, GRAPE_PACKAGING_DEFAULTS } from "@/lib/profit";
import * as A from "@/lib/services/analytics";

/**
 * Read-only, permission-scoped data access for the assistant. The assistant never receives a tool that
 * writes data: any suggested change is presented as a link the user must open and confirm themselves.
 * Only aggregates and the minimum fields needed are included (no contact details, no credentials).
 */

export type Intent = "profit" | "unpaid" | "inventory" | "calc" | "draft_email" | "draft_whatsapp" | "draft_quote" | "shipments" | "inventory_actions" | "scenarios" | "help";

export interface ContextSection { title: string; lines: string[]; restricted?: boolean }
export interface AssistantAction { label: string; href: string }
export interface AssistantContext { intents: Intent[]; sections: ContextSection[]; actions: AssistantAction[]; params: Record<string, string | number | undefined> }

const VARIETY_ALIASES: [RegExp, string][] = [
  [/red\s*globe/i, "Red Globe"], [/crimson/i, "Crimson Seedless"], [/scarlet/i, "Scarlet Seedless"], [/sugra/i, "Sugraone"], [/chili\s*black/i, "Chili Black"],
  [/red\s*delicious/i, "Red Delicious"], [/golden/i, "Golden Delicious"], [/gala/i, "Gala"], [/jirdi|mountain/i, "Jirdi (Lebanese mountain)"],
  [/nectarine/i, "Red Nectarine"], [/peach/i, "Yellow Peach"],
];

export function detectIntents(q: string): Intent[] {
  const s = q.toLowerCase();
  const out = new Set<Intent>();
  if (/(calculat|what if|if i (export|sell)|profit if)/.test(s) && /\d/.test(s)) out.add("calc");
  if (/(scenario|best case|worst case|compare)/.test(s)) out.add("scenarios");
  if (!out.has("calc") && /(profit|revenue|margin|how much .*(make|earn)|p&l|income)/.test(s)) out.add("profit");
  if (/(unpaid|overdue|owe|outstanding|receivable|not paid|haven.t paid)/.test(s)) out.add("unpaid");
  if (/(whatsapp|whats app)/.test(s)) out.add("draft_whatsapp");
  else if (/(quotation|quote|offer)/.test(s) && /(write|draft|prepare|create)/.test(s)) out.add("draft_quote");
  else if (/(email|e-mail|mail)/.test(s) && /(write|draft|prepare|compose)/.test(s)) out.add("draft_email");
  if (/(shipment|container|vessel|in transit|eta|arriv)/.test(s)) out.add("shipments");
  if (/(suggest|recommend|action|what should|expir|aging|slow)/.test(s) && /(inventory|stock|batch|fruit)/.test(s)) out.add("inventory_actions");
  else if (/(kg|kilogram|available|in stock|inventory|stock|how many)/.test(s) && !out.has("calc")) out.add("inventory");
  if (!out.size) out.add("help");
  return [...out];
}

function extractNumbers(q: string) {
  const kgM = q.match(/([\d.,]+)\s*(k\b|kg|kilo|tons?|t\b)/i);
  let kg: number | undefined;
  if (kgM) {
    const n = Number(kgM[1].replace(/,/g, ""));
    kg = /ton|^t$/i.test(kgM[2]) ? n * 1000 : /^k$/i.test(kgM[2]) ? n * 1000 : n;
  }
  const priceM = q.match(/\$\s*([\d.]+)|([\d.]+)\s*(usd|\$|dollars?)\s*(per|\/)\s*k/i) ?? q.match(/at\s*\$?\s*([\d.]+)/i);
  const price = priceM ? Number(priceM[1] ?? priceM[2]) : undefined;
  return { kg, price };
}

function extractVariety(q: string): string | undefined {
  for (const [re, name] of VARIETY_ALIASES) if (re.test(q)) return name;
  if (/apple/i.test(q)) return "Red Delicious";
  if (/grape/i.test(q)) return "Red Globe";
  return undefined;
}

const CITY_COUNTRY: Record<string, string> = { dubai: "United Arab Emirates", "abu dhabi": "United Arab Emirates", uae: "United Arab Emirates", riyadh: "Saudi Arabia", jeddah: "Saudi Arabia", saudi: "Saudi Arabia", doha: "Qatar", qatar: "Qatar", kuwait: "Kuwait", basra: "Iraq", baghdad: "Iraq", iraq: "Iraq", miami: "United States", "new york": "United States", usa: "United States", mexico: "Mexico", monterrey: "Mexico", casablanca: "Morocco", morocco: "Morocco", algeria: "Algeria", tunisia: "Tunisia" };

function extractPlace(q: string) {
  const s = q.toLowerCase();
  const hit = Object.keys(CITY_COUNTRY).find((k) => s.includes(k));
  return hit ? { city: hit.replace(/\b\w/g, (c) => c.toUpperCase()), country: CITY_COUNTRY[hit] } : undefined;
}

export async function gatherContext(user: SessionUser, question: string): Promise<AssistantContext> {
  const intents = detectIntents(question);
  const sections: ContextSection[] = [];
  const actions: AssistantAction[] = [];
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user.role, p);
  const deny = (title: string) => sections.push({ title, lines: ["You do not have permission to view this information."], restricted: true });
  const { kg, price } = extractNumbers(question);
  const variety = extractVariety(question);
  const place = extractPlace(question);
  const params: AssistantContext["params"] = { kg, price, variety, city: place?.city, country: place?.country };

  if (intents.includes("profit")) {
    if (!can("analytics:finance")) deny("Profit & revenue");
    else {
      const key = /last 30|30 days/i.test(question) ? "30d" : /year|ytd/i.test(question) ? "year" : /today/i.test(question) ? "today" : /week|7 days/i.test(question) ? "7d" : "month";
      const r = resolveRange(key);
      const [pl, prev] = await Promise.all([A.profitAndLoss(r.from, r.toExclusive), A.profitAndLoss(r.prevFrom, r.prevToExclusive)]);
      sections.push({
        title: `Profit & loss (${isoDate(r.from)} to ${isoDate(r.to)})`,
        lines: [
          `Revenue: ${formatMoney(pl.revenue)} (previous period ${formatMoney(prev.revenue)})`,
          `Cost of goods sold: ${formatMoney(pl.cogs)}`,
          `Gross profit: ${formatMoney(pl.grossProfit)} (${pl.grossMarginPct.toFixed(1)}% gross margin)`,
          `Shipment logistics: ${formatMoney(pl.logistics)}; operating expenses: ${formatMoney(pl.opex)}`,
          `Net operating profit: ${formatMoney(pl.netProfit)} (previous period ${formatMoney(prev.netProfit)})`,
          "Method: revenue = issued sales + storage invoices − credit notes; net = gross − logistics − approved expenses.",
        ],
      });
      actions.push({ label: "Open analytics", href: `/analytics?range=${key}` });
    }
  }

  if (intents.includes("unpaid")) {
    if (!can("finance:read")) deny("Unpaid invoices");
    else {
      const invs = await prisma.invoice.findMany({ where: { type: { in: ["SALES", "COLD_STORAGE"] }, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { customer: true }, orderBy: { dueDate: "asc" }, take: 25 });
      const today = todayDate();
      const total = invs.reduce((a, i) => a.plus(D(i.total).minus(D(i.amountPaid))), D(0));
      sections.push({
        title: `Unpaid customer invoices (${invs.length}, total ${formatMoney(total)})`,
        lines: invs.length ? invs.map((i) => `${i.invoiceNo} — ${i.customer?.companyName}: ${formatMoney(D(i.total).minus(D(i.amountPaid)), i.currency)} due ${isoDate(i.dueDate)}${i.dueDate < today ? ` (OVERDUE ${Math.floor((today.getTime() - i.dueDate.getTime()) / 86400000)} days)` : ""}`) : ["No unpaid customer invoices."],
      });
      actions.push({ label: "Open receivables", href: "/invoices?status=open" });
    }
  }

  if (intents.includes("inventory") || intents.includes("draft_quote") || intents.includes("calc")) {
    if (!can("inventory:read")) { if (intents.includes("inventory")) deny("Inventory"); }
    else {
      const rows = await A.inventoryByVariety();
      const filtered = variety ? rows.filter((r) => r.name === variety) : rows;
      sections.push({
        title: variety ? `Inventory — ${variety}` : "Inventory by variety",
        lines: (filtered.length ? filtered : rows).map((r) => `${r.name}: ${formatKg(r.kg)} on hand, ${formatKg(r.reserved)} reserved, ${formatKg(r.available)} available`).concat(variety && !filtered.length ? [`No ${variety} currently in stock.`] : []),
      });
      if (intents.includes("inventory")) actions.push({ label: "Open inventory", href: variety ? `/inventory?q=${encodeURIComponent(variety)}` : "/inventory" });
    }
  }

  if (intents.includes("calc") || intents.includes("scenarios")) {
    if (!can("profit:use")) deny("Profit calculation");
    else {
      const v = variety ?? "Red Delicious";
      const ref = await prisma.productVariety.findFirst({ where: { name: v } });
      const isGrape = /globe|seedless|sugra|chili/i.test(v);
      const qty = kg ?? 20000;
      const sell = price ?? (isGrape ? 2.4 : 1.1);
      const cost = ref?.referenceCostKg ? Number(ref.referenceCostKg) : isGrape ? 1.5 : 0.55;
      const input = {
        variety: v, purchaseCostPerKg: cost, totalKg: qty, cartonWeightKg: isGrape ? 5 : 18,
        packagingItems: isGrape ? GRAPE_PACKAGING_DEFAULTS : [{ name: "Carton & liner", costPerCarton: 0.85 }],
        packagingLaborPerCarton: isGrape ? 0.15 : 0.25, sortingCostPerKg: 0.02, refrigerationCost: Math.round(qty * 0.01), inlandTransport: 600, portHandling: 350, customsCharges: 250, freight: 3200, insurance: 150, miscCosts: 100, sellingPricePerKg: sell, desiredMarginPct: 15,
      };
      const r = calculateProfit(input);
      sections.push({
        title: `Profit estimate — ${formatKg(qty)} ${v} at ${formatMoney(sell)}/kg`,
        lines: [
          `Assumptions (editable defaults, not live market prices): purchase ${formatMoney(cost)}/kg, ${input.cartonWeightKg} kg cartons, 1×40' reefer freight $3,200, insurance $150, inland $600, port $350, customs $250, refrigeration ${formatMoney(input.refrigerationCost)}`,
          `Cartons: ${r.cartons}; purchase ${formatMoney(r.totalPurchaseCost)}; packaging ${formatMoney(r.totalPackagingCost)}; logistics ${formatMoney(r.totalLogisticsCost)}`,
          `Total landed cost: ${formatMoney(r.totalLandedCost)} (${formatMoney(r.costPerKg)}/kg)`,
          `Revenue: ${formatMoney(r.revenueUSD)}; gross profit: ${formatMoney(r.grossProfit)}`,
          `Gross margin ${r.grossMarginPct}% (profit ÷ revenue); markup ${r.markupPct}% (profit ÷ cost)`,
          `Break-even price: ${formatMoney(r.breakEvenPricePerKg)}/kg; price for a 15% margin: ${formatMoney(r.targetPricePerKg)}/kg`,
        ],
      });
      if (intents.includes("scenarios")) {
        sections.push({
          title: "Scenario comparison",
          lines: Object.entries(DEFAULT_SCENARIOS).map(([k, d]) => {
            const s = calculateProfit(applyScenario(input, d));
            return `${k}: purchase ${d.purchasePct >= 0 ? "+" : ""}${d.purchasePct}%, freight ${d.freightPct >= 0 ? "+" : ""}${d.freightPct}%, selling ${d.sellingPct >= 0 ? "+" : ""}${d.sellingPct}% → profit ${formatMoney(s.grossProfit)} (${s.grossMarginPct}%)`;
          }),
        });
      }
      actions.push({ label: "Refine in profit calculator", href: "/profit-calculator" });
    }
  }

  if (intents.includes("shipments")) {
    if (!can("shipments:read")) deny("Shipments");
    else {
      const ships = await prisma.shipment.findMany({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } }, include: { customer: true }, orderBy: { eta: "asc" }, take: 15 });
      sections.push({
        title: `Open shipments (${ships.length})`,
        lines: ships.length ? ships.map((s) => `${s.shipmentNo} (${s.containerNo ?? "no container"}) → ${s.customer.companyName}, ${s.portOfLoading ?? s.origin} to ${s.portOfDischarge ?? s.destination}: ${s.status.replaceAll("_", " ").toLowerCase()}, ETD ${isoDate(s.etd) || "—"}, ETA ${isoDate(s.eta) || "—"}`) : ["No open shipments."],
      });
      sections.push({ title: "Tracking note", lines: ["Statuses are those recorded by staff. No live carrier tracking is connected, so actual vessel positions are not known."] });
      actions.push({ label: "Open shipments", href: "/shipments" });
    }
  }

  if (intents.includes("inventory_actions")) {
    if (!can("inventory:read")) deny("Inventory suggestions");
    else {
      const today = todayDate();
      const [expiring, old, util] = await Promise.all([
        prisma.inventoryBatch.findMany({ where: { onHandKg: { gt: 0 }, expiryDate: { lte: addDays(today, 14) } }, include: { variety: true }, orderBy: { expiryDate: "asc" }, take: 10 }),
        prisma.inventoryBatch.findMany({ where: { onHandKg: { gt: 0 }, arrivalDate: { lte: addDays(today, -90) } }, include: { variety: true }, orderBy: { arrivalDate: "asc" }, take: 10 }),
        A.roomUtilization(),
      ]);
      sections.push({ title: "Batches expiring within 14 days", lines: expiring.length ? expiring.map((b) => `${b.batchNo} ${b.variety.name}: ${formatKg(D(b.onHandKg).minus(D(b.reservedKg)))} available, best before ${isoDate(b.expiryDate)}`) : ["None."] });
      sections.push({ title: "Stock older than 90 days", lines: old.length ? old.map((b) => `${b.batchNo} ${b.variety.name}: ${formatKg(b.onHandKg)}, arrived ${isoDate(b.arrivalDate)}`) : ["None."] });
      sections.push({ title: "Cold-room utilization", lines: util.map((u) => `${u.code}: ${u.pct.toFixed(0)}% (${formatKg(u.availableKg)} free)${u.status !== "OPERATIONAL" ? `, ${u.status.toLowerCase()}` : ""}`) });
      actions.push({ label: "FIFO / FEFO view", href: "/inventory/aging" });
    }
  }

  if (intents.some((i) => i.startsWith("draft_"))) {
    if (!can("customers:read")) deny("Customer list");
    else {
      const custs = await prisma.customer.findMany({ where: { archivedAt: null, ...(place ? { OR: [{ city: { contains: place.city, mode: "insensitive" } }, { country: place.country }] } : {}) }, take: 5, orderBy: { companyName: "asc" } });
      sections.push({ title: place ? `Customers in ${place.city}` : "Customers", lines: custs.map((c) => `${c.companyName} (${c.city ?? ""}, ${c.country}) — contact ${c.contactPerson ?? "n/a"}, terms ${c.paymentTerms ?? `${c.paymentTermsDays} days`}`) });
      if (intents.includes("draft_quote") && can("quotations:write")) actions.push({ label: "Create the quotation in the system", href: custs[0] ? `/quotations/new?customer=${custs[0].id}` : "/quotations/new" });
    }
  }

  return { intents, sections, actions, params };
}
