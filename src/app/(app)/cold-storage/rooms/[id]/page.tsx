import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { SimpleLine } from "@/components/charts/charts";
import { D, formatKg } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { roomUtilization } from "@/lib/services/analytics";
import { roomFields } from "../../room-fields";
import { RoomActions } from "./room-actions";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("storage:read");
  const { id } = await params;
  const r = await prisma.coldRoom.findUnique({ where: { id }, include: { warehouse: true, readings: { orderBy: { recordedAt: "desc" }, take: 60, include: { recordedBy: true } }, batches: { where: { onHandKg: { gt: 0 } }, include: { variety: true } }, storageContracts: { where: { status: "ACTIVE" }, include: { customer: true } } } });
  if (!r) notFound();
  const util = (await roomUtilization()).find((x) => x.id === id)!;
  const wh = (await prisma.warehouse.findMany()).map((w) => ({ value: w.id, label: w.name }));
  const chart = [...r.readings].reverse().map((x) => ({ x: x.recordedAt.toISOString().slice(5, 10), temp: Number(x.temperatureC), target: Number(r.targetTempC), humidity: x.humidity ? Number(x.humidity) : null }));
  return (
    <div className="space-y-4">
      <PageHeader title={`${r.code} · ${r.name}`} crumbs={[{ label: "Cold storage", href: "/cold-storage" }, { label: r.code }]} description={<span className="flex items-center gap-2"><StatusBadge status={r.status} />{r.warehouse.name}</span>}
        actions={can(user, "storage:write") ? <RoomActions id={r.id} fields={roomFields(wh)} values={{ code: r.code, name: r.name, warehouseId: r.warehouseId, capacityKg: r.capacityKg.toString(), targetTempC: r.targetTempC.toString(), targetHumidity: r.targetHumidity.toString(), tempToleranceC: r.tempToleranceC.toString(), status: r.status, maintenanceNotes: r.maintenanceNotes ?? "", sensorId: r.sensorId ?? "" }} /> : undefined} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Capacity", formatKg(r.capacityKg)], ["Occupied", formatKg(util.occupiedKg)], ["Available", formatKg(util.availableKg)], ["Current temp", r.currentTempC !== null ? `${D(r.currentTempC).toFixed(1)}°C (target ${D(r.targetTempC).toFixed(1)})` : "—"], ["Current humidity", r.currentHumidity !== null ? `${D(r.currentHumidity).toFixed(0)}% (target ${D(r.targetHumidity).toFixed(0)})` : "—"]].map(([l, v]) => (
          <Card key={l} className="p-4"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div><div className="mt-1 text-base font-semibold tabular">{v}</div></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Temperature log</CardTitle><CardDescription>Manually recorded readings (no live sensor connected{r.sensorId ? `; sensor ${r.sensorId} mapped for future integration` : ""})</CardDescription></CardHeader>
          <CardContent>{chart.length ? <SimpleLine data={chart} keys={[{ key: "temp", name: "Recorded °C" }, { key: "target", name: "Target °C" }]} /> : <p className="text-xs text-muted-foreground">No readings yet.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Room details</CardTitle></CardHeader>
          <CardContent><dl className="grid gap-3"><Field label="Tolerance">±{D(r.tempToleranceC).toFixed(1)} °C</Field><Field label="Own stock">{formatKg(util.ownKg)}</Field><Field label="Customer goods">{formatKg(util.customerKg)}</Field><Field label="Maintenance notes">{r.maintenanceNotes}</Field></dl></CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Batches in this room</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{r.batches.map((b) => <li key={b.id} className="flex justify-between py-1.5"><Link className="font-mono text-xs text-primary hover:underline" href={`/inventory/${b.id}`}>{b.batchNo}</Link><span>{b.variety.name} · <span className="tabular">{formatKg(b.onHandKg)}</span></span></li>)}{r.batches.length === 0 && <li className="text-xs text-muted-foreground">Empty</li>}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent readings</CardTitle></CardHeader>
          <CardContent><ul className="divide-y text-sm">{r.readings.slice(0, 10).map((x) => <li key={x.id} className="flex items-center justify-between py-1.5"><span className="text-xs">{formatDateTime(x.recordedAt)} · {x.recordedBy?.name ?? x.source}</span><span className="flex items-center gap-2 tabular">{D(x.temperatureC).toFixed(1)}°C {x.humidity && `· ${D(x.humidity).toFixed(0)}%`}{x.outOfRange && <Badge variant="danger">out of range</Badge>}</span></li>)}</ul></CardContent>
        </Card>
      </div>
      {r.storageContracts.length > 0 && <Card><CardHeader><CardTitle>Active storage contracts</CardTitle></CardHeader><CardContent><ul className="text-sm">{r.storageContracts.map((c) => <li key={c.id}><Link className="text-primary hover:underline" href={`/cold-storage/contracts/${c.id}`}>{c.contractNo}</Link> — {c.customer.companyName}</li>)}</ul></CardContent></Card>}
    </div>
  );
}
