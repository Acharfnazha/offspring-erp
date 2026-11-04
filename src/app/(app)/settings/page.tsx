import Link from "next/link";
import { UserCircle, ScrollText } from "lucide-react";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSetting } from "@/lib/options";
import { GRAPE_PACKAGING_DEFAULTS } from "@/lib/profit";
import { KeyValueForm, PackagingForm, RatesForm } from "./setting-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const ro = !can(user, "settings:manage");
  const [company, billing, rates, pack, inv] = await Promise.all([
    getSetting<Record<string, string>>("company", { name: "Offspring Group S.A.R.L." }),
    getSetting<{ ratePerKgMonth: string; minimumPeriods: number }>("storageBilling", { ratePerKgMonth: "0.05", minimumPeriods: 1 }),
    getSetting<Record<string, number>>("exchangeRates", { USD: 1 }),
    getSetting("packagingDefaults", { cartonWeightKg: 5, laborPerCarton: 0.15, items: GRAPE_PACKAGING_DEFAULTS }),
    getSetting<{ allocationStrategy: string; expiryAlertDays: number }>("inventory", { allocationStrategy: "FEFO", expiryAlertDays: 7 }),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description={ro ? "Read-only: your role cannot change application settings." : "Application-wide configuration. Changes are audited."} actions={<>
        <Button variant="outline" asChild><Link href="/settings/profile"><UserCircle />My profile & security</Link></Button>
        {can(user, "audit:read") && <Button variant="outline" asChild><Link href="/settings/audit"><ScrollText />Audit log</Link></Button>}
      </>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Company profile</CardTitle><CardDescription>Shown on quotations, invoices and statements</CardDescription></CardHeader><CardContent>
          <KeyValueForm settingKey="company" disabled={ro} value={company} fields={[{ name: "name", label: "Legal name" }, { name: "address", label: "Address" }, { name: "phone", label: "Phone" }, { name: "email", label: "Email" }, { name: "website", label: "Website" }, { name: "taxId", label: "Tax / registration ID" }, { name: "bank", label: "Bank payment instructions", type: "textarea" }]} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Cold-storage billing policy</CardTitle><CardDescription>Default for new storage contracts. Started billing months are charged in full, counted from the entry date.</CardDescription></CardHeader><CardContent>
          <KeyValueForm settingKey="storageBilling" disabled={ro} value={billing} fields={[{ name: "ratePerKgMonth", label: "Rate (USD per kg per billing month)", help: "Default 0.05" }, { name: "minimumPeriods", label: "Minimum billing months", type: "number", help: "Applies to same-day entry/exit" }]} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Exchange rates</CardTitle></CardHeader><CardContent><RatesForm value={rates} disabled={ro} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Packaging defaults</CardTitle><CardDescription>Used by the profit calculator</CardDescription></CardHeader><CardContent><PackagingForm value={pack} disabled={ro} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Inventory allocation</CardTitle></CardHeader><CardContent>
          <KeyValueForm settingKey="inventory" disabled={ro} value={inv} fields={[{ name: "allocationStrategy", label: "Reservation strategy", type: "select", options: ["FEFO", "FIFO"], help: "FEFO = earliest best-before first; FIFO = oldest arrival first" }, { name: "expiryAlertDays", label: "Expiry alert (days ahead)", type: "number" }]} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>AI assistant</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <p>Provider: <b>{process.env.AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY ? `Anthropic (${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"})` : "Offline demo mode"}</b></p>
          <p className="text-xs text-muted-foreground">Configured through environment variables (<code>AI_PROVIDER</code>, <code>ANTHROPIC_API_KEY</code>) — keys are never stored in the database or shown in the UI. The assistant is read-only and only receives data permitted for the asking user.</p>
        </CardContent></Card>
      </div>
    </div>
  );
}
