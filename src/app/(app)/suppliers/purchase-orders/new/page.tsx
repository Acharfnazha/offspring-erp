import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentForm } from "@/components/forms/document-form";
import { supplierOptions, varietyOptions } from "@/lib/options";
import { GRADES, opts } from "@/lib/schemas";
import { businessDate } from "@/lib/dates";
import { str, type SP } from "@/lib/list-params";
import { createPurchaseOrderAction } from "../../actions";

export default async function NewPOPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("suppliers:write");
  const sp = await searchParams;
  const [suppliers, varieties, vRows] = await Promise.all([supplierOptions(), varietyOptions(), prisma.productVariety.findMany()]);
  const fill = Object.fromEntries(vRows.map((v) => [v.id, { unitCostKg: v.referenceCostKg?.toString() ?? "" }]));
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="New purchase order" crumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: "New purchase order" }]} description="Inventory is only created when goods are received against this PO." />
      <DocumentForm
        schema="purchaseOrder"
        action={createPurchaseOrderAction}
        redirectTo="/suppliers/purchase-orders/:id"
        submitLabel="Create purchase order"
        qtyKey="quantityKg" priceKey="unitCostKg"
        defaultValues={{ supplierId: str(sp, "supplier") ?? suppliers[0]?.value ?? "", orderDate: businessDate(), currency: "USD", items: [{ varietyId: varieties[0]?.value, grade: "CLASS_I", quantityKg: "", unitCostKg: fill[varieties[0]?.value ?? ""]?.unitCostKg ?? "" }] }}
        newLine={{ varietyId: varieties[0]?.value, grade: "CLASS_I", quantityKg: "", unitCostKg: "" }}
        header={[
          { name: "supplierId", label: "Supplier", type: "select", options: suppliers, span: 2 },
          { name: "orderDate", label: "Order date", type: "date" },
          { name: "expectedDate", label: "Expected delivery", type: "date" },
          { name: "currency", label: "Currency" },
          { name: "notes", label: "Notes", type: "textarea", span: 3 },
        ]}
        lineCols={[
          { name: "varietyId", label: "Variety", type: "select", options: varieties, width: "col-span-2 md:col-span-5", onSelectFill: fill },
          { name: "grade", label: "Grade", type: "select", options: opts(GRADES) },
          { name: "quantityKg", label: "Qty (kg)", type: "number", width: "md:col-span-2" },
          { name: "unitCostKg", label: "Cost/kg", type: "number", width: "md:col-span-2" },
        ]}
      />
    </div>
  );
}
