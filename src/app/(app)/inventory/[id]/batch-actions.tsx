"use client";
import { ArrowRightLeft, Lock, Trash2, Truck, SlidersHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EntityForm } from "@/components/forms/entity-form";
import { GRADES, opts } from "@/lib/schemas";
import { adjustAction, dispatchAction, reserveAction, spoilageAction, transferAction, updateBatchAction } from "../actions";
import { useState } from "react";

export function BatchActions({ batch, rooms, suppliers }: {
  batch: { id: string; batchNo: string; available: string; onHand: string; coldRoomId: string | null; edit: Record<string, unknown> };
  rooms: { value: string; label: string }[];
  suppliers: { value: string; label: string }[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const otherRooms = rooms.filter((r) => r.value !== batch.coldRoomId);
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        trigger={<Button variant="outline" size="sm"><ArrowRightLeft />Transfer</Button>}
        title={`Transfer ${batch.batchNo}`}
        description={`Up to ${batch.available} kg unreserved can be moved. A partial transfer splits the batch into a new child batch at the destination.`}
        fields={[{ name: "room", label: "Destination cold room", type: "select", options: otherRooms }, { name: "qty", label: "Quantity (kg)", type: "number", defaultValue: batch.available, required: true }, { name: "notes", label: "Notes", type: "text" }]}
        submitLabel="Transfer"
        onSubmit={(v) => transferAction(batch.id, v.room, Number(v.qty), v.notes)}
        redirect={(d) => (d && typeof d === "object" && "id" in d && (d as { id: string }).id !== batch.id ? `/inventory/${(d as { id: string }).id}` : undefined)}
      />
      <ActionDialog
        trigger={<Button variant="outline" size="sm"><Lock />Reserve</Button>}
        title="Reserve stock"
        description={`Available: ${batch.available} kg. Order confirmations reserve automatically; use this for manual holds.`}
        fields={[{ name: "qty", label: "Quantity (kg)", type: "number", required: true }, { name: "note", label: "Reason / customer", type: "text", required: true }]}
        submitLabel="Reserve"
        onSubmit={(v) => reserveAction(batch.id, Number(v.qty), v.note)}
      />
      <ActionDialog
        trigger={<Button variant="outline" size="sm"><Truck />Dispatch</Button>}
        title="Record sales dispatch (unreserved stock)"
        description="To dispatch against an order, use the order's Dispatch action so reservations and fulfilment are updated."
        fields={[{ name: "qty", label: "Quantity (kg)", type: "number", required: true }, { name: "ref", label: "Reference", type: "text", required: true }]}
        submitLabel="Dispatch"
        onSubmit={(v) => dispatchAction(batch.id, Number(v.qty), v.ref)}
      />
      <ActionDialog
        trigger={<Button variant="outline" size="sm"><Trash2 />Spoilage</Button>}
        title="Record spoilage"
        destructive
        fields={[{ name: "qty", label: "Spoiled quantity (kg)", type: "number", required: true }, { name: "notes", label: "Cause / notes", type: "textarea", required: true }]}
        submitLabel="Record spoilage"
        onSubmit={(v) => spoilageAction(batch.id, Number(v.qty), v.notes)}
      />
      <ActionDialog
        trigger={<Button variant="outline" size="sm"><SlidersHorizontal />Adjust</Button>}
        title="Stock count adjustment"
        description="Sets the counted on-hand quantity. The difference is posted as an ADJUSTMENT movement and audited."
        fields={[{ name: "qty", label: "Counted on-hand (kg)", type: "number", defaultValue: batch.onHand, required: true }, { name: "reason", label: "Reason", type: "textarea", required: true }]}
        submitLabel="Post adjustment"
        onSubmit={(v) => adjustAction(batch.id, Number(v.qty), v.reason)}
      />
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil />Edit</Button></DialogTrigger>
        <DialogContent wide>
          <DialogHeader><DialogTitle>Edit {batch.batchNo}</DialogTitle></DialogHeader>
          <EntityForm
            schema="batchEdit"
            defaultValues={batch.edit}
            action={(v) => updateBatchAction(batch.id, v)}
            onDone={() => setEditOpen(false)}
            fields={[
              { name: "grade", label: "Grade", type: "select", options: opts(GRADES) },
              { name: "customGrade", label: "Custom grade label" },
              { name: "origin", label: "Origin" },
              { name: "supplierId", label: "Supplier", type: "select", options: [{ value: "", label: "— None —" }, ...suppliers] },
              { name: "harvestDate", label: "Harvest date", type: "date" },
              { name: "expiryDate", label: "Best-before", type: "date" },
              { name: "packagingType", label: "Packaging" },
              { name: "cartons", label: "Cartons", type: "number", step: "1" },
              { name: "status", label: "Quality hold", type: "select", options: [{ value: "AVAILABLE", label: "Released (available)" }, { value: "QUARANTINE", label: "Quarantine (blocked)" }] },
              { name: "notes", label: "Notes", type: "textarea", span: 2 },
            ]}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
