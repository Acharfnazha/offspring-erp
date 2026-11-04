import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { saveSupplierAction } from "../../actions";
import { SUPPLIER_FIELDS } from "../../supplier-fields";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("suppliers:write");
  const { id } = await params;
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${s.name}`} crumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: s.name, href: `/suppliers/${s.id}` }, { label: "Edit" }]} />
      <Card><CardContent className="pt-5"><EntityForm schema="supplier" action={saveSupplierAction.bind(null, s.id)} redirectTo="/suppliers/:id" defaultValues={Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ""]))} fields={SUPPLIER_FIELDS} /></CardContent></Card>
    </div>
  );
}
