import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { saveCustomerAction } from "../actions";
import { CUSTOMER_FIELDS } from "../customer-fields";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  await requireUser("customers:write");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New customer" crumbs={[{ label: "Customers", href: "/customers" }, { label: "New" }]} />
      <Card><CardContent className="pt-5">
        <EntityForm schema="customer" action={saveCustomerAction.bind(null, null)} redirectTo="/customers/:id" submitLabel="Create customer"
          defaultValues={{ companyName: "", country: "", type: "IMPORTER", currency: "USD", paymentTermsDays: 30, creditLimit: 0, pipelineStage: "NEW_LEAD" }} fields={CUSTOMER_FIELDS} />
      </CardContent></Card>
    </div>
  );
}
