import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { roomOptions, varietyOptions, getSetting } from "@/lib/options";
import { businessDate } from "@/lib/dates";
import { createContractAction } from "../../actions";

export default async function NewContractPage() {
  await requireUser("storage:write");
  const [customers, rooms, varieties, policy] = await Promise.all([
    prisma.customer.findMany({ where: { archivedAt: null }, orderBy: [{ type: "desc" }, { companyName: "asc" }] }),
    roomOptions(), varietyOptions(),
    getSetting<{ ratePerKgMonth: string; minimumPeriods: number }>("storageBilling", { ratePerKgMonth: "0.05", minimumPeriods: 1 }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New storage contract" crumbs={[{ label: "Cold storage", href: "/cold-storage" }, { label: "New contract" }]} description="Records customer-owned goods entering a cold room. Billing follows the configured policy; staged removals are billed per quantity." />
      <Card><CardContent className="pt-5">
        <EntityForm schema="storageContract" action={createContractAction} redirectTo="/cold-storage/contracts/:id" submitLabel="Create contract"
          defaultValues={{ customerId: customers[0]?.id, coldRoomId: rooms[0]?.value, varietyId: "", productDescription: "", quantityKg: "", ratePerKgMonth: policy.ratePerKgMonth, minimumPeriods: policy.minimumPeriods, entryDate: businessDate() }}
          fields={[
            { name: "customerId", label: "Customer", type: "select", options: customers.map((c) => ({ value: c.id, label: `${c.companyName}${c.type === "COLD_STORAGE_CUSTOMER" ? " ★" : ""}` })), span: 2 },
            { name: "varietyId", label: "Product variety", type: "select", options: [{ value: "", label: "— Other —" }, ...varieties] },
            { name: "productDescription", label: "Product description" },
            { name: "batchReference", label: "Customer batch reference" },
            { name: "coldRoomId", label: "Cold room", type: "select", options: rooms },
            { name: "quantityKg", label: "Quantity entering (kg)", type: "number" },
            { name: "entryDate", label: "Entry date", type: "date" },
            { name: "ratePerKgMonth", label: "Billing rate (USD/kg/month)", type: "number", step: "0.0001" },
            { name: "minimumPeriods", label: "Minimum billing months", type: "number", step: "1", help: "Applied to same-day entry/exit" },
            { name: "notes", label: "Notes", type: "textarea", span: 2 },
          ]} />
      </CardContent></Card>
    </div>
  );
}
