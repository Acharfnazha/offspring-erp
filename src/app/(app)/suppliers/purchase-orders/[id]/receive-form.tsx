"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PackageCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRADES, label } from "@/lib/schemas";
import { receiveGoodsAction } from "../../actions";

export function ReceiveForm({ poId, items, rooms, today }: { poId: string; items: { id: string; name: string; grade: string; outstanding: string }[]; rooms: { value: string; label: string }[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(today);
  const [invoice, setInvoice] = useState(true);
  const [lines, setLines] = useState(items.map((i) => ({ poItemId: i.id, quantityKg: i.outstanding, cartons: "0", coldRoomId: rooms[0]?.value ?? "", expiryDate: "", packagingType: "", grade: i.grade })));
  const upd = (idx: number, k: string, v: string) => setLines(lines.map((l, i) => (i === idx ? { ...l, [k]: v } : l)));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><PackageCheck />Receive goods</Button></DialogTrigger>
      <DialogContent wide>
        <DialogHeader><DialogTitle>Goods receipt</DialogTitle><DialogDescription>Validated in a single transaction: batches are created, cold-room capacity is checked and RECEIPT movements are posted. Leave quantity at 0 for lines not delivered.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Received on</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} />Create supplier bill (purchase invoice)</label>
        </div>
        {items.map((it, idx) => (
          <div key={it.id} className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:grid-cols-6">
            <div className="col-span-2 md:col-span-6 text-sm font-medium">{it.name} <span className="text-xs text-muted-foreground">· outstanding {it.outstanding} kg</span></div>
            <div className="space-y-1"><Label className="text-[10px]">Qty (kg)</Label><Input type="number" step="any" value={lines[idx].quantityKg} onChange={(e) => upd(idx, "quantityKg", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-[10px]">Cartons</Label><Input type="number" value={lines[idx].cartons} onChange={(e) => upd(idx, "cartons", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-[10px]">Grade</Label><NativeSelect value={lines[idx].grade} onChange={(e) => upd(idx, "grade", e.target.value)}>{GRADES.map((g) => <option key={g} value={g}>{label(g)}</option>)}</NativeSelect></div>
            <div className="space-y-1 col-span-2 md:col-span-1"><Label className="text-[10px]">Cold room</Label><NativeSelect value={lines[idx].coldRoomId} onChange={(e) => upd(idx, "coldRoomId", e.target.value)}>{rooms.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</NativeSelect></div>
            <div className="space-y-1"><Label className="text-[10px]">Best before</Label><Input type="date" value={lines[idx].expiryDate} onChange={(e) => upd(idx, "expiryDate", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-[10px]">Packaging</Label><Input value={lines[idx].packagingType} onChange={(e) => upd(idx, "packagingType", e.target.value)} /></div>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            const r = await receiveGoodsAction(poId, { receivedAt: date, createInvoice: invoice, lines });
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            toast.success(r.message ?? "Received");
            setOpen(false);
            router.refresh();
          }}>{busy && <Loader2 className="animate-spin" />}Post receipt</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
