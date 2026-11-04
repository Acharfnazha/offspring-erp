"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, FileText, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionDialog } from "@/components/forms/action-dialog";
import { generateStorageInvoiceAction, storageAdjustmentAction, storageMovementAction } from "../../actions";

export function ContractActions({ id, today, canWrite, canBill, active }: { id: string; today: string; canWrite: boolean; canBill: boolean; active: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canWrite && active && (
        <>
          <ActionDialog trigger={<Button variant="outline" size="sm"><ArrowDownToLine />Goods in</Button>} title="Additional goods entering" fields={[{ name: "quantityKg", label: "Quantity (kg)", type: "number", required: true }, { name: "date", label: "Date", type: "date", defaultValue: today, required: true }, { name: "notes", label: "Notes" }]} onSubmit={(v) => storageMovementAction(id, { ...v, type: "IN" })} />
          <ActionDialog trigger={<Button variant="outline" size="sm"><ArrowUpFromLine />Goods out</Button>} title="Release goods (staged removal)" description="Each removed quantity is billed for its own storage period (FIFO by entry date)." fields={[{ name: "quantityKg", label: "Quantity (kg)", type: "number", required: true }, { name: "date", label: "Exit date", type: "date", defaultValue: today, required: true }, { name: "notes", label: "Notes" }]} onSubmit={(v) => storageMovementAction(id, { ...v, type: "OUT" })} />
        </>
      )}
      {canBill && <ActionDialog trigger={<Button variant="outline" size="sm"><BadgeDollarSign />Manual adjustment</Button>} title="Billing adjustment" description="Positive amounts add a charge, negative amounts give a credit. Requires a reason and is recorded in the audit trail." fields={[{ name: "amount", label: "Amount (USD, ±)", type: "number", required: true }, { name: "reason", label: "Reason", type: "textarea", required: true }]} onSubmit={(v) => storageAdjustmentAction(id, v)} />}
    </div>
  );
}

export function InvoiceFromBilling({ id, asOf, disabled }: { id: string; asOf: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={disabled || busy} onClick={async () => {
      setBusy(true);
      const r = await generateStorageInvoiceAction(id, asOf);
      setBusy(false);
      if (!r.ok) return toast.error(r.error);
      toast.success(r.message ?? "Invoice created");
      router.push(`/invoices/${(r.data as { id: string }).id}`);
    }}><FileText />Generate invoice through {asOf}</Button>
  );
}

export function AsOfPicker({ value }: { value: string }) {
  const router = useRouter();
  return <Input type="date" aria-label="Bill through date" className="h-8 w-40" defaultValue={value} onChange={(e) => e.target.value && router.push(`?asOf=${e.target.value}`)} />;
}
