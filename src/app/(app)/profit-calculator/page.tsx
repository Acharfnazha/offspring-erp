import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/forms/action-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getSetting } from "@/lib/options";
import { GRAPE_PACKAGING_DEFAULTS, SAMPLE_REFERENCE_PRICES } from "@/lib/profit";
import { formatDateTime } from "@/lib/dates";
import { ProfitCalculator } from "./calculator";
import { deleteCalculationAction } from "./actions";

export const metadata = { title: "Profit calculator" };

export default async function ProfitPage() {
  const user = await requireUser("profit:use");
  const [varieties, pack, rates, saved] = await Promise.all([
    prisma.productVariety.findMany({ orderBy: { name: "asc" } }),
    getSetting<{ cartonWeightKg: number; items: { name: string; costPerCarton: number }[]; laborPerCarton: number }>("packagingDefaults", { cartonWeightKg: 5, items: GRAPE_PACKAGING_DEFAULTS, laborPerCarton: 0.15 }),
    getSetting<Record<string, number>>("exchangeRates", { USD: 1 }),
    prisma.profitCalculation.findMany({ where: ["SUPER_ADMIN", "ADMIN"].includes(user.role) ? {} : { createdById: user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { createdBy: true } }),
  ]);
  const ref: Record<string, number> = { ...Object.fromEntries(varieties.filter((v) => v.referenceCostKg).map((v) => [v.name, Number(v.referenceCostKg)])), ...SAMPLE_REFERENCE_PRICES };
  const names = Array.from(new Set([...varieties.map((v) => v.name), ...Object.keys(SAMPLE_REFERENCE_PRICES)])).sort();
  return (
    <div className="space-y-4">
      <PageHeader title="Export profit calculator" description="Landed cost, margin vs. markup, break-even and target pricing. All figures use decimal arithmetic; reference prices are illustrative samples only." />
      <ProfitCalculator varieties={names} refPrices={ref} rates={rates} canQuote={can(user, "quotations:write")}
        defaults={{ variety: "Red Globe", purchaseCostPerKg: ref["Red Globe"] ?? 1.5, totalKg: 20000, cartonWeightKg: pack.cartonWeightKg, packagingItems: pack.items, packagingLaborPerCarton: pack.laborPerCarton, sortingCostPerKg: 0.02, refrigerationCost: 400, inlandTransport: 600, portHandling: 350, customsCharges: 250, freight: 3200, insurance: 150, miscCosts: 100, sellingPricePerKg: 2.4, sellingCurrency: "USD", exchangeRate: 1, desiredMarginPct: 20 }} />
      <Card>
        <CardHeader><CardTitle>Saved calculations</CardTitle></CardHeader>
        <CardContent>
          {saved.length === 0 ? <p className="text-xs text-muted-foreground">No saved calculations yet.</p> : (
            <ul className="divide-y text-sm">{saved.map((c) => { const o = c.outputs as Record<string, string>; return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.createdBy?.name} · {formatDateTime(c.createdAt)} · landed ${Number(o.totalLandedCost).toLocaleString()} · profit ${Number(o.grossProfit).toLocaleString()} ({o.grossMarginPct}%)</div></div>
                <div className="flex gap-2">
                  {can(user, "quotations:write") && <Button size="sm" variant="outline" asChild><Link href={`/quotations/new?calc=${c.id}`}>Convert to quotation</Link></Button>}
                  <ActionButton action={deleteCalculationAction.bind(null, c.id)} confirmTitle="Delete calculation?" variant="ghost">Delete</ActionButton>
                </div>
              </li>); })}</ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
