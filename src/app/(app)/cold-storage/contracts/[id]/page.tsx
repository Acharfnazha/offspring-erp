import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { D, formatKg, formatMoney } from "@/lib/money";
import { businessDate, formatDate, parseDateOnly } from "@/lib/dates";
import { str, type SP } from "@/lib/list-params";
import { contractBillingSummary } from "@/lib/services/storage";
import { closeContractAction } from "../../actions";
import { AsOfPicker, ContractActions, InvoiceFromBilling } from "./contract-actions";

export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser("storage:read");
  const { id } = await params;
  const sp = await searchParams;
  let asOf = businessDate();
  try { if (str(sp, "asOf")) asOf = businessDate(parseDateOnly(str(sp, "asOf")!), "UTC"); } catch { /* ignore invalid */ }
  const c = await prisma.storageContract.findUnique({ where: { id }, include: { customer: true, coldRoom: true, variety: true, movements: { orderBy: { date: "asc" } }, invoices: { orderBy: { issueDate: "desc" } }, adjustments: { orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  let summary: Awaited<ReturnType<typeof contractBillingSummary>> | null = null;
  let billingError: string | null = null;
  try { summary = await contractBillingSummary(prisma, id, parseDateOnly(asOf)); } catch (e) { billingError = (e as Error).message; }
  const fin = can(user, "finance:read");
  const canBill = can(user, "storage:billing");
  return (
    <div className="space-y-4">
      <PageHeader title={`${c.contractNo} · ${c.customer.companyName}`} crumbs={[{ label: "Cold storage", href: "/cold-storage" }, { label: c.contractNo }]} description={<span className="flex items-center gap-2"><StatusBadge status={c.status} />{c.productDescription} · {c.coldRoom.code}</span>}
        actions={<>
          <ContractActions id={c.id} today={businessDate()} canWrite={can(user, "storage:write")} canBill={canBill} active={c.status === "ACTIVE"} />
          {can(user, "storage:write") && c.status === "ACTIVE" && summary?.billing.onHandKg.eq(0) && <ActionButton action={closeContractAction.bind(null, c.id)} confirmTitle="Close contract?">Close contract</ActionButton>}
        </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Contract</CardTitle></CardHeader>
          <CardContent><dl className="grid gap-3">
            <Field label="Customer"><Link className="text-primary hover:underline" href={`/customers/${c.customerId}`}>{c.customer.companyName}</Link></Field>
            <Field label="Product">{c.variety?.name ?? c.productDescription}</Field>
            <Field label="Customer batch ref">{c.batchReference}</Field>
            <Field label="Cold room"><Link className="text-primary hover:underline" href={`/cold-storage/rooms/${c.coldRoomId}`}>{c.coldRoom.code} · {c.coldRoom.name}</Link></Field>
            <Field label="Entry / exit">{formatDate(c.entryDate)} → {c.exitDate ? formatDate(c.exitDate) : "in storage"}</Field>
            <Field label="Billing policy">{formatMoney(c.ratePerKgMonth)} per kg per billing month (4 dp: {D(c.ratePerKgMonth).toFixed(4)}); started months billed in full; minimum {c.minimumPeriods} month(s)</Field>
            <Field label="Currently stored">{summary ? formatKg(summary.billing.onHandKg) : "—"}</Field>
          </dl></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div><CardTitle>Billing calculation</CardTitle><CardDescription>Each quantity is billed according to its own storage period</CardDescription></div>
            <AsOfPicker value={asOf} />
          </CardHeader>
          <CardContent>
            {billingError && <p className="text-sm text-red-600">{billingError}</p>}
            {summary && (
              <>
                <table className="w-full text-sm">
                  <thead className="border-b text-[11px] uppercase text-muted-foreground"><tr><th className="py-2 text-start">Quantity</th><th className="py-2 text-start">Period</th><th className="py-2 text-end">Months</th><th className="py-2 text-end">Charge</th></tr></thead>
                  <tbody>
                    {summary.billing.slices.map((s, i) => (
                      <tr key={i} className="border-b last:border-0"><td className="py-2 tabular">{formatKg(s.quantityKg)}</td><td className="py-2 text-xs">{s.entryDate} → {s.exitDate} {s.open && <Badge variant="info">still stored</Badge>}</td><td className="py-2 text-end tabular">{s.periods}</td><td className="py-2 text-end tabular">{formatMoney(s.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="ms-auto mt-3 w-full max-w-sm space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Cumulative storage charges</span><span className="tabular">{formatMoney(summary.billing.total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Previously invoiced</span><span className="tabular">−{formatMoney(summary.previouslyBilled)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending adjustments</span><span className="tabular">{formatMoney(summary.adjustmentsTotal)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-semibold"><span>To invoice</span><span className="tabular">{formatMoney(summary.amountToInvoice)}</span></div>
                </div>
                {canBill && <div className="mt-4 flex justify-end"><InvoiceFromBilling id={c.id} asOf={asOf} disabled={summary.amountToInvoice.lte(0)} /></div>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Storage movements</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{c.movements.map((m) => <li key={m.id} className="flex justify-between py-1.5"><span><Badge variant={m.type === "IN" ? "success" : "info"}>{m.type}</Badge> <span className="ms-1 text-xs">{formatDate(m.date)}</span> <span className="text-xs text-muted-foreground">{m.notes}</span></span><span className="tabular">{formatKg(m.quantityKg)}</span></li>)}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Invoices & adjustments</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="divide-y">{c.invoices.map((i) => <li key={i.id} className="flex justify-between py-1.5">{fin ? <Link className="text-primary hover:underline" href={`/invoices/${i.id}`}>{i.invoiceNo}</Link> : i.invoiceNo}<span className="flex items-center gap-2 tabular">{formatMoney(i.total)} <StatusBadge status={i.status} /></span></li>)}{c.invoices.length === 0 && <li className="text-xs text-muted-foreground">No invoices yet.</li>}</ul>
            {c.adjustments.length > 0 && <ul className="divide-y border-t pt-2">{c.adjustments.map((a) => <li key={a.id} className="flex justify-between py-1.5 text-xs"><span>{a.reason} {a.invoiceId ? <Badge variant="muted">invoiced</Badge> : <Badge variant="warning">pending</Badge>}</span><span className="tabular">{formatMoney(a.amount)}</span></li>)}</ul>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
