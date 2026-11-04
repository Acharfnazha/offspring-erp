"use client";
import { useState } from "react";
import { Pencil, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { EntityForm, type FieldDef } from "@/components/forms/entity-form";
import { recordReadingAction, saveRoomAction } from "../../actions";

export function RoomActions({ id, fields, values }: { id: string; fields: FieldDef[]; values: Record<string, unknown> }) {
  const [r, setR] = useState(false);
  const [e, setE] = useState(false);
  return (
    <>
      <Dialog open={r} onOpenChange={setR}>
        <DialogTrigger asChild><Button><Thermometer />Record reading</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Record manual reading</DialogTitle><DialogDescription>Readings are entered manually by staff. Out-of-tolerance values raise a temperature alert.</DialogDescription></DialogHeader>
          <EntityForm schema="reading" cols={2} action={(v) => recordReadingAction(id, v)} onDone={() => setR(false)} defaultValues={{ temperatureC: "", humidity: "" }}
            fields={[{ name: "temperatureC", label: "Temperature (°C)", type: "number", step: "0.1" }, { name: "humidity", label: "Relative humidity (%)", type: "number", step: "0.1" }]} />
        </DialogContent>
      </Dialog>
      <Dialog open={e} onOpenChange={setE}>
        <DialogTrigger asChild><Button variant="outline"><Pencil />Edit room</Button></DialogTrigger>
        <DialogContent wide>
          <DialogHeader><DialogTitle>Edit cold room</DialogTitle></DialogHeader>
          <EntityForm schema="coldRoom" action={(v) => saveRoomAction(id, v)} onDone={() => setE(false)} fields={fields} defaultValues={values} />
        </DialogContent>
      </Dialog>
    </>
  );
}
