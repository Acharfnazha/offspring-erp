import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { roomOptions, supplierOptions, varietyOptions } from "@/lib/options";
import { GRADES, opts } from "@/lib/schemas";
import { businessDate } from "@/lib/dates";
import { createBatchAction } from "../actions";

export const metadata = { title: "Receive inventory" };

export default async function NewBatchPage() {
  await requireUser("inventory:write");
  const [varieties, rooms, suppliers] = await Promise.all([varietyOptions(), roomOptions(), supplierOptions()]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Receive inventory" crumbs={[{ label: "Inventory", href: "/inventory" }, { label: "New batch" }]} description="Creates a batch, assigns it to a cold room and posts a RECEIPT movement. For supplier deliveries against a purchase order use Suppliers → Purchase orders → Receive." />
      <Card><CardContent className="pt-5">
        <EntityForm
          schema="batch"
          action={createBatchAction}
          redirectTo="/inventory/:id"
          submitLabel="Receive batch"
          cols={3}
          defaultValues={{ varietyId: varieties[0]?.value ?? "", grade: "CLASS_I", origin: "Lebanon", arrivalDate: businessDate(), quantityKg: "", cartons: 0, costPerKg: "", coldRoomId: rooms[0]?.value ?? "", supplierId: "" }}
          fields={[
            { name: "varietyId", label: "Fruit variety", type: "select", options: varieties, section: "Product" },
            { name: "grade", label: "Grade", type: "select", options: opts(GRADES) },
            { name: "customGrade", label: "Custom grade label", placeholder: "Only for Custom grade" },
            { name: "origin", label: "Origin" },
            { name: "supplierId", label: "Supplier", type: "select", options: [{ value: "", label: "— None —" }, ...suppliers] },
            { name: "packagingType", label: "Packaging", placeholder: "e.g. 5 kg carton" },
            { name: "quantityKg", label: "Quantity (kg)", type: "number", section: "Quantity & cost" },
            { name: "cartons", label: "Cartons", type: "number", step: "1" },
            { name: "costPerKg", label: "Cost per kg (USD)", type: "number", step: "0.0001" },
            { name: "harvestDate", label: "Harvest date", type: "date", section: "Dates & location" },
            { name: "arrivalDate", label: "Arrival date", type: "date" },
            { name: "expiryDate", label: "Best-before date", type: "date", help: "Enables FEFO allocation & expiry alerts" },
            { name: "coldRoomId", label: "Storage location", type: "select", options: [{ value: "", label: "— Unassigned —" }, ...rooms] },
            { name: "notes", label: "Notes", type: "textarea", span: 2 },
          ]}
        />
      </CardContent></Card>
    </div>
  );
}
