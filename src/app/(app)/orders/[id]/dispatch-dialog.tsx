"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dispatchOrderAction } from "../actions";

export function DispatchDialog({ orderId, items, shipments }: { orderId: string; items: { id: string; name: string; outstanding: string; reserved: string }[]; shipments: { value: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shipmentId, setShipmentId] = useState(shipments[0]?.value ?? "");
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, i.outstanding])));
  const [cartons, setCartons] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Truck />Dispatch</Button></DialogTrigger>
      <DialogContent wide>
        <DialogHeader><DialogTitle>Dispatch inventory</DialogTitle><DialogDescription>Consumes this order&apos;s reservations first, then unreserved stock (FEFO). Partial quantities are allowed; stock can never go negative.</DialogDescription></DialogHeader>
        <div className="space-y-1"><Label>Load onto shipment (optional)</Label><NativeSelect value={shipmentId} onChange={(e) => setShipmentId(e.target.value)}><option value="">— Not linked —</option>{shipments.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</NativeSelect></div>
        {items.map((i) => (
          <div key={i.id} className="grid grid-cols-3 items-end gap-2 rounded-md border p-3">
            <div className="col-span-3 text-sm font-medium">{i.name} <span className="text-xs text-muted-foreground">· outstanding {i.outstanding} kg · reserved {i.reserved} kg</span></div>
            <div className="col-span-2 space-y-1"><Label className="text-[10px]">Dispatch (kg)</Label><Input type="number" step="any" value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-[10px]">Cartons</Label><Input type="number" value={cartons[i.id] ?? ""} onChange={(e) => setCartons({ ...cartons, [i.id]: e.target.value })} /></div>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            const r = await dispatchOrderAction(orderId, { shipmentId, lines: items.map((i) => ({ orderItemId: i.id, quantityKg: qty[i.id] || 0, cartons: cartons[i.id] || undefined })) });
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            toast.success(r.message ?? "Dispatched");
            setOpen(false);
            router.refresh();
          }}>{busy && <Loader2 className="animate-spin" />}Post dispatch</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
