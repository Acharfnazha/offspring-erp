import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { isoDate } from "@/lib/dates";
import { saveCustomerAction } from "../../actions";
import { CUSTOMER_FIELDS } from "../../customer-fields";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("customers:write");
  const { id } = await params;
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) notFound();
  const dv = Object.fromEntries(Object.entries({ ...c, creditLimit: c.creditLimit.toString(), nextFollowUpAt: isoDate(c.nextFollowUpAt) }).map(([k, v]) => [k, v ?? ""]));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${c.companyName}`} crumbs={[{ label: "Customers", href: "/customers" }, { label: c.companyName, href: `/customers/${c.id}` }, { label: "Edit" }]} />
      <Card><CardContent className="pt-5">
        <EntityForm schema="customer" action={saveCustomerAction.bind(null, c.id)} redirectTo="/customers/:id" defaultValues={dv} fields={CUSTOMER_FIELDS} />
      </CardContent></Card>
    </div>
  );
}
