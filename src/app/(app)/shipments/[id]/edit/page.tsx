import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { customerOptions } from "@/lib/options";
import { isoDate } from "@/lib/dates";
import { saveShipmentAction } from "../../actions";
import { shipmentFields } from "../../shipment-fields";

export default async function EditShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("shipments:write");
  const { id } = await params;
  const s = await prisma.shipment.findUnique({ where: { id } });
  if (!s) notFound();
  const customers = await customerOptions();
  const dv: Record<string, unknown> = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v instanceof Date ? isoDate(v) : v === null ? "" : typeof v === "object" ? String(v) : v]));
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Edit ${s.shipmentNo}`} crumbs={[{ label: "Shipments", href: "/shipments" }, { label: s.shipmentNo, href: `/shipments/${s.id}` }, { label: "Edit" }]} />
      <Card><CardContent className="pt-5"><EntityForm schema="shipment" cols={3} action={saveShipmentAction.bind(null, s.id, [])} redirectTo="/shipments/:id" fields={shipmentFields(customers)} defaultValues={dv} /></CardContent></Card>
    </div>
  );
}
