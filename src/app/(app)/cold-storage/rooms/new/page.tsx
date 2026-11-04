import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { saveRoomAction } from "../../actions";
import { roomFields } from "../../room-fields";

export default async function NewRoomPage() {
  await requireUser("storage:write");
  const wh = (await prisma.warehouse.findMany()).map((w) => ({ value: w.id, label: w.name }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New cold room" crumbs={[{ label: "Cold storage", href: "/cold-storage" }, { label: "New room" }]} />
      <Card><CardContent className="pt-5"><EntityForm schema="coldRoom" action={saveRoomAction.bind(null, null)} redirectTo="/cold-storage/rooms/:id" fields={roomFields(wh)} defaultValues={{ code: "", name: "", warehouseId: wh[0]?.value, capacityKg: "", targetTempC: 0.5, targetHumidity: 90, tempToleranceC: 1.5, status: "OPERATIONAL" }} /></CardContent></Card>
    </div>
  );
}
