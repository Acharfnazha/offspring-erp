import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { saveSupplierAction } from "../actions";
import { SUPPLIER_FIELDS } from "../supplier-fields";

export default async function NewSupplierPage() {
  await requireUser("suppliers:write");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New supplier" crumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: "New" }]} />
      <Card><CardContent className="pt-5"><EntityForm schema="supplier" action={saveSupplierAction.bind(null, null)} redirectTo="/suppliers/:id" defaultValues={{ name: "", country: "Lebanon", paymentTermsDays: 30, qualityRating: "" }} fields={SUPPLIER_FIELDS} /></CardContent></Card>
    </div>
  );
}
