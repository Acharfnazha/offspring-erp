"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPaymentAction } from "../actions";

export interface OpenInvoice { id: string; no: string; partyId: string; direction: "INCOMING" | "OUTGOING"; currency: string; balance: string; due: string; status: string }

export function PaymentForm({ customers, suppliers, invoices, today, preset }: { customers: { value: string; label: string }[]; suppliers: { value: string; label: string }[]; invoices: OpenInvoice[]; today: string; preset?: { direction: "INCOMING" | "OUTGOING"; partyId: string; invoiceId: string } }) {
  const router = useRouter();
  const [key] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const [direction, setDirection] = useState<"INCOMING" | "OUTGOING">(preset?.direction ?? "INCOMING");
  const [partyId, setPartyId] = useState(preset?.partyId ?? customers[0]?.value ?? "");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [currency, setCurrency] = useState(invoices.find((i) => i.id === preset?.invoiceId)?.currency ?? "USD");
  const presetBal = invoices.find((i) => i.id === preset?.invoiceId)?.balance ?? "";
  const [amount, setAmount] = useState(presetBal);
  const [paidAt, setPaidAt] = useState(today);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [alloc, setAlloc] = useState<Record<string, string>>(preset ? { [preset.invoiceId]: presetBal } : {});
  const [busy, setBusy] = useState(false);
  const open = useMemo(() => invoices.filter((i) => i.direction === direction && i.partyId === partyId && i.currency === currency), [invoices, direction, partyId, currency]);
  const d = (v: string) => { try { return new Decimal(v || 0); } catch { return new Decimal(0); } };
  const allocated = open.reduce((a, i) => a.plus(d(alloc[i.id] ?? "")), new Decimal(0));
  const unallocated = d(amount).minus(allocated);
  const parties = direction === "INCOMING" ? customers : suppliers;

  const autoAllocate = () => {
    let left = d(amount);
    const next: Record<string, string> = {};
    for (const i of [...open].sort((a, b) => a.due.localeCompare(b.due))) {
      if (left.lte(0)) break;
      const take = Decimal.min(left, d(i.balance));
      next[i.id] = take.toFixed(2);
      left = left.minus(take);
    }
    setAlloc(next);
  };

  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (unallocated.lt(0)) return toast.error("Allocations exceed the payment amount");
      setBusy(true);
      const res = await recordPaymentAction({ direction, customerId: direction === "INCOMING" ? partyId : "", supplierId: direction === "OUTGOING" ? partyId : "", method, amount, currency, paidAt, reference, notes, idempotencyKey: key, allocations: open.filter((i) => d(alloc[i.id] ?? "").gt(0)).map((i) => ({ invoiceId: i.id, amount: alloc[i.id] })) });
      setBusy(false);
      if (!res.ok) return toast.error(res.error);
      toast.success("Payment recorded");
      router.push(`/payments/${(res.data as { id: string }).id}`);
      router.refresh();
    }}>
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5"><Label htmlFor="direction">Direction</Label><NativeSelect id="direction" value={direction} onChange={(e) => { const dir = e.target.value as "INCOMING" | "OUTGOING"; setDirection(dir); setPartyId((dir === "INCOMING" ? customers : suppliers)[0]?.value ?? ""); setAlloc({}); }}><option value="INCOMING">Received from customer</option><option value="OUTGOING">Paid to supplier</option></NativeSelect></div>
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="party">{direction === "INCOMING" ? "Customer" : "Supplier"}</Label><NativeSelect id="party" value={partyId} onChange={(e) => { setPartyId(e.target.value); setAlloc({}); }}>{parties.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect></div>
          <div className="space-y-1.5"><Label htmlFor="method">Method</Label><NativeSelect id="method" value={method} onChange={(e) => setMethod(e.target.value)}><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="OTHER">Other</option></NativeSelect></div>
          <div className="space-y-1.5"><Label htmlFor="amount">Amount</Label><Input id="amount" type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="currency">Currency</Label><Input id="currency" value={currency} maxLength={3} onChange={(e) => { setCurrency(e.target.value.toUpperCase()); setAlloc({}); }} /></div>
          <div className="space-y-1.5"><Label htmlFor="paidAt">Payment date</Label><Input id="paidAt" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="reference">Bank / receipt reference</Label><Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="SWIFT / cheque / receipt no." /></div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Allocate to open invoices</CardTitle><CardDescription>Unallocated amounts are kept on account as an advance and can be allocated later.</CardDescription></div>
          <Button type="button" variant="outline" size="sm" onClick={autoAllocate} disabled={!open.length}>Auto-allocate (oldest first)</Button>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? <p className="text-sm text-muted-foreground">No open {currency} invoices for this {direction === "INCOMING" ? "customer" : "supplier"} — the full amount will be recorded as an advance payment.</p> : (
            <table className="w-full text-sm">
              <thead className="border-b text-[11px] uppercase text-muted-foreground"><tr><th className="py-2 text-start">Invoice</th><th className="py-2 text-start">Due</th><th className="py-2 text-end">Open balance</th><th className="py-2 text-end">Allocate</th></tr></thead>
              <tbody>{open.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{i.no} <span className="text-[10px] text-muted-foreground">{i.status.toLowerCase()}</span></td>
                  <td className="py-2 text-xs">{i.due}</td>
                  <td className="py-2 text-end tabular">{new Decimal(i.balance).toFixed(2)}</td>
                  <td className="py-2 text-end"><Input aria-label={`Allocate to ${i.no}`} className="ms-auto h-8 w-32 text-end" type="number" step="0.01" min="0" max={i.balance} value={alloc[i.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [i.id]: e.target.value })} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <div className="mt-3 flex justify-end gap-6 text-sm"><span>Allocated: <b className="tabular">{allocated.toFixed(2)}</b></span><span className={unallocated.lt(0) ? "text-red-600" : ""}>Unallocated: <b className="tabular">{unallocated.toFixed(2)}</b></span></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button><Button disabled={busy || !partyId}>{busy && <Loader2 className="animate-spin" />}Record payment</Button></div>
    </form>
  );
}
