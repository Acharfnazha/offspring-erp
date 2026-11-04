"use client";
import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { billingPeriods, storageCharge } from "@/lib/storage-billing";
import { parseDateOnly } from "@/lib/dates";

export function BillingCalculator({ defaultRate, today }: { defaultRate: string; today: string }) {
  const [qty, setQty] = useState("10000");
  const [entry, setEntry] = useState(today);
  const [exit, setExit] = useState(today);
  const [rate, setRate] = useState(defaultRate);
  const result = useMemo(() => {
    try {
      const e = parseDateOnly(entry), x = parseDateOnly(exit);
      const periods = billingPeriods(e, x, 1);
      return { periods, amount: storageCharge(qty || 0, e, x, { ratePerKgMonth: rate || 0 }).toFixed(2), days: Math.round((x.getTime() - e.getTime()) / 86400000) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [qty, entry, exit, rate]);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" />Storage charge calculator</CardTitle><CardDescription>Any started billing month counts as a full month, anchored to the entry date.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="bc-qty">Quantity (kg)</Label><Input id="bc-qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bc-rate">Rate (USD/kg/month)</Label><Input id="bc-rate" type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bc-entry">Entry date</Label><Input id="bc-entry" type="date" value={entry} onChange={(e) => setEntry(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="bc-exit">Exit date</Label><Input id="bc-exit" type="date" value={exit} onChange={(e) => setExit(e.target.value)} /></div>
        </div>
        <div className="rounded-lg bg-primary/5 p-3" data-testid="storage-calc-result">
          {"error" in result ? <p className="text-sm text-red-600">{result.error}</p> : (
            <div className="flex items-end justify-between">
              <div className="text-xs text-muted-foreground">{result.days} days → <b className="text-foreground">{result.periods}</b> billing month(s)</div>
              <div className="text-2xl font-semibold tabular">${Number(result.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
