"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, FileText, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyScenario, calculateProfit, sensitivity, DEFAULT_SCENARIOS, type ProfitInput, type ScenarioDelta } from "@/lib/profit";
import { SimpleLine } from "@/components/charts/charts";
import { saveCalculationAction } from "./actions";
import { cn } from "@/lib/utils";

type Inputs = Required<Pick<ProfitInput, "variety" | "purchaseCostPerKg" | "totalKg" | "cartonWeightKg" | "packagingItems" | "packagingLaborPerCarton" | "sortingCostPerKg" | "refrigerationCost" | "inlandTransport" | "portHandling" | "customsCharges" | "freight" | "insurance" | "miscCosts" | "sellingPricePerKg" | "sellingCurrency" | "exchangeRate" | "desiredMarginPct">>;

const usd = (v: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));

export function ProfitCalculator({ varieties, refPrices, defaults, rates, canQuote }: { varieties: string[]; refPrices: Record<string, number>; defaults: Inputs; rates: Record<string, number>; canQuote: boolean }) {
  const router = useRouter();
  const [i, setI] = useState<Inputs>(defaults);
  const [name, setName] = useState("");
  const [scen, setScen] = useState<Record<string, ScenarioDelta>>(DEFAULT_SCENARIOS);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setI((p) => ({ ...p, [k]: v }));
  const calc = useMemo(() => { try { return { r: calculateProfit(i) }; } catch (e) { return { err: (e as Error).message }; } }, [i]);
  const scenarios = useMemo(() => { try { return Object.entries(scen).map(([k, d]) => ({ k, d, r: calculateProfit(applyScenario(i, d)) })); } catch { return []; } }, [i, scen]);
  const sens = useMemo(() => { try { return sensitivity(i).map((s) => ({ x: `${s.change > 0 ? "+" : ""}${s.change}%`, Freight: Number(s.freight), "Purchase price": Number(s.purchase), "Selling price": Number(s.selling) })); } catch { return []; } }, [i]);

  const num = (k: keyof Inputs, lbl: string, step = "0.01", help?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`pc-${k}`} className="text-[11px]">{lbl}</Label>
      <Input id={`pc-${k}`} type="number" step={step} min="0" value={String(i[k] ?? "")} onChange={(e) => set(k, (e.target.value === "" ? 0 : Number(e.target.value)) as never)} />
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
  const r = calc.r;
  const save = async (thenQuote: boolean) => {
    const res = await saveCalculationAction(name || `${i.variety} ${i.totalKg} kg @ ${i.sellingPricePerKg}`, i);
    if (!res.ok) return toast.error(res.error);
    toast.success("Calculation saved");
    const id = (res.data as { id: string }).id;
    if (thenQuote) router.push(`/quotations/new?calc=${id}`); else router.refresh();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="space-y-4 xl:col-span-3">
        <Card>
          <CardHeader><CardTitle>Product & volume</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="pc-variety" className="text-[11px]">Fruit variety</Label>
              <NativeSelect id="pc-variety" value={i.variety} onChange={(e) => { const v = e.target.value; set("variety", v); if (refPrices[v] !== undefined) set("purchaseCostPerKg", refPrices[v]); }}>
                {varieties.map((v) => <option key={v}>{v}</option>)}
              </NativeSelect>
              {refPrices[i.variety] !== undefined && <p className="text-[10px] text-amber-600">Sample reference price {usd(refPrices[i.variety])}/kg — not a live market price. Edit freely.</p>}
            </div>
            {num("purchaseCostPerKg", "Purchase cost / kg (USD)", "0.001")}
            {num("totalKg", "Total kilograms", "1")}
            <div className="space-y-1"><Label className="text-[11px]">Carton weight (kg)</Label><NativeSelect value={String(i.cartonWeightKg)} onChange={(e) => set("cartonWeightKg", Number(e.target.value))}>{[4.5, 5, 8, 9, 10, 13, 18].map((w) => <option key={w} value={w}>{w} kg</option>)}</NativeSelect></div>
            {num("desiredMarginPct", "Desired gross margin %", "0.5")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Packaging (per carton)</CardTitle><CardDescription>Editable defaults — e.g. grape preservation sheet, carton, absorbent pad</CardDescription></div>
            <Button size="sm" variant="outline" onClick={() => set("packagingItems", [...i.packagingItems, { name: "New item", costPerCarton: 0 }])}><Plus />Item</Button></CardHeader>
          <CardContent className="space-y-2">
            {i.packagingItems.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input aria-label="Packaging item" value={p.name} onChange={(e) => set("packagingItems", i.packagingItems.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Cost per carton" className="w-32" type="number" step="0.01" min="0" value={p.costPerCarton} onChange={(e) => set("packagingItems", i.packagingItems.map((x, j) => (j === idx ? { ...x, costPerCarton: Number(e.target.value) } : x)))} />
                <Button size="icon" variant="ghost" onClick={() => set("packagingItems", i.packagingItems.filter((_, j) => j !== idx))} aria-label="Remove"><Trash2 /></Button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">{num("packagingLaborPerCarton", "Packaging labor / carton")}{num("sortingCostPerKg", "Sorting cost / kg", "0.001")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Logistics & other costs (totals, USD)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {num("refrigerationCost", "Refrigeration")}{num("inlandTransport", "Inland transport")}{num("portHandling", "Port handling")}{num("customsCharges", "Customs-related")}
            {num("freight", "Ocean / air freight")}{num("insurance", "Insurance")}{num("miscCosts", "Miscellaneous")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Selling price</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1"><Label className="text-[11px]">Selling currency</Label><NativeSelect value={i.sellingCurrency} onChange={(e) => { set("sellingCurrency", e.target.value); set("exchangeRate", rates[e.target.value] ?? 1); }}>{Object.keys(rates).map((c) => <option key={c}>{c}</option>)}</NativeSelect></div>
            {num("exchangeRate", `Rate (${i.sellingCurrency} per USD)`, "0.0001", "From settings; editable")}
            {num("sellingPricePerKg", `Selling price / kg (${i.sellingCurrency})`, "0.001")}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4 xl:col-span-2">
        <Card className="xl:sticky xl:top-20">
          <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Results</CardTitle><Button size="sm" variant="ghost" onClick={() => setI(defaults)}><RotateCcw />Reset</Button></CardHeader>
          <CardContent>
            {calc.err && <p className="text-sm text-red-600">Check inputs: {calc.err.slice(0, 160)}</p>}
            {r && (
              <div className="space-y-3" data-testid="profit-results">
                <div className="grid grid-cols-2 gap-2">
                  <div className={cn("rounded-lg p-3", Number(r.grossProfit) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10")}><div className="text-[10px] uppercase text-muted-foreground">Gross profit</div><div className={cn("text-xl font-semibold tabular", Number(r.grossProfit) < 0 && "text-red-600")} data-testid="gross-profit">{usd(r.grossProfit)}</div></div>
                  <div className="rounded-lg bg-muted p-3"><div className="text-[10px] uppercase text-muted-foreground">Gross margin · markup</div><div className="text-xl font-semibold tabular">{r.grossMarginPct}% · {r.markupPct}%</div></div>
                </div>
                <p className="text-[11px] text-muted-foreground">Gross margin = profit ÷ revenue. Markup = profit ÷ landed cost.</p>
                <dl className="space-y-1 text-sm">
                  {[["Cartons", String(r.cartons)], ["Total purchase cost", usd(r.totalPurchaseCost)], ["Total packaging cost", usd(r.totalPackagingCost)], ["Sorting", usd(r.sortingCost)], ["Total logistics cost", usd(r.totalLogisticsCost)], ["Total landed cost", usd(r.totalLandedCost)], ["Cost per kg", usd(r.costPerKg)], ["Cost per carton", usd(r.costPerCarton)], ["Revenue (USD)", usd(r.revenueUSD)], ...(i.sellingCurrency !== "USD" ? [[`Revenue (${i.sellingCurrency})`, `${Number(r.revenueSellingCurrency).toLocaleString()} ${i.sellingCurrency}`]] : []), ["Break-even price / kg", usd(r.breakEvenPricePerKg)], [`Target price / kg @ ${i.desiredMarginPct}% margin`, `${usd(r.targetPricePerKg)} (${Number(r.targetPricePerKgSellingCurrency).toFixed(3)} ${i.sellingCurrency})`]].map(([k, v]) => (
                    <div key={k} className={cn("flex justify-between gap-2", k === "Total landed cost" && "border-t pt-1 font-semibold")}><dt className="text-muted-foreground">{k}</dt><dd className="tabular">{v}</dd></div>
                  ))}
                </dl>
                <div className="space-y-2 border-t pt-3">
                  <Input placeholder="Calculation name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Calculation name" />
                  <div className="flex gap-2"><Button className="flex-1" variant="outline" onClick={() => save(false)}><Save />Save</Button>{canQuote && <Button className="flex-1" onClick={() => save(true)}><FileText />Save & quote</Button>}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="xl:col-span-3">
        <CardHeader><CardTitle>Scenario comparison</CardTitle><CardDescription>Adjust % changes to purchase price, freight and selling price</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-[11px] uppercase text-muted-foreground"><tr><th className="py-2 text-start">Scenario</th><th className="py-2">Purchase Δ%</th><th className="py-2">Freight Δ%</th><th className="py-2">Selling Δ%</th><th className="py-2 text-end">Landed cost</th><th className="py-2 text-end">Gross profit</th><th className="py-2 text-end">Margin</th></tr></thead>
            <tbody>{scenarios.map(({ k, d, r: s }) => (
              <tr key={k} className="border-b last:border-0">
                <td className="py-2 font-medium capitalize">{k}</td>
                {(["purchasePct", "freightPct", "sellingPct"] as const).map((f) => <td key={f} className="px-1 py-2"><Input aria-label={`${k} ${f}`} className="h-8 w-20" type="number" value={d[f]} onChange={(e) => setScen({ ...scen, [k]: { ...d, [f]: Number(e.target.value) } })} /></td>)}
                <td className="py-2 text-end tabular">{usd(s.totalLandedCost)}</td>
                <td className={cn("py-2 text-end font-semibold tabular", Number(s.grossProfit) < 0 && "text-red-600")}>{usd(s.grossProfit)}</td>
                <td className="py-2 text-end tabular">{s.grossMarginPct}%</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader><CardTitle>Sensitivity</CardTitle><CardDescription>Gross profit when one driver changes</CardDescription></CardHeader>
        <CardContent><SimpleLine data={sens} keys={[{ key: "Freight", name: "Freight" }, { key: "Purchase price", name: "Purchase price" }, { key: "Selling price", name: "Selling price" }]} format="usd" height={230} /></CardContent>
      </Card>
    </div>
  );
}
