import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { customerOptions } from "@/lib/options";
import { str, type SP } from "@/lib/list-params";
import { D, sum } from "@/lib/money";
import { saveShipmentAction } from "../actions";
import { shipmentFields } from "../shipment-fields";

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("shipments:write");
  const sp = await searchParams;
  const customers = await customerOptions();
  const order = str(sp, "order") ? await prisma.salesOrder.findUnique({ where: { id: str(sp, "order") }, include: { customer: true, items: true } }) : null;
  const kg = order ? sum(order.items.map((i) => i.quantityKg)) : D(0);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="New shipment" crumbs={[{ label: "Shipments", href: "/shipments" }, { label: "New" }]} description={order ? `Linked to order ${order.orderNo}` : "Link orders from the shipment page or create it from an order."} />
      <Card><CardContent className="pt-5">
        <EntityForm schema="shipment" cols={3} action={saveShipmentAction.bind(null, null, order ? [order.id] : [])} redirectTo="/shipments/:id" submitLabel="Create shipment" fields={shipmentFields(customers)}
          defaultValues={{ customerId: order?.customerId ?? customers[0]?.value, transportMode: "SEA", containerType: "40' Reefer HC", origin: "Lebanon", destination: order?.customer.country ?? "", portOfLoading: "Beirut", netWeightKg: kg.gt(0) ? kg.toString() : "", grossWeightKg: kg.gt(0) ? kg.mul(1.08).toFixed(0) : "", freightCost: 0, insuranceCost: 0, documentationCost: 0, customsCost: 0 }} />
      </CardContent></Card>
    </div>
  );
}
