import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { businessDate } from "@/lib/dates";
import { quotationFormData } from "../../quotations/form-data";
import { OrderForm } from "../order-form";

export const metadata = { title: "New order" };

export default async function NewOrderPage() {
  await requireUser("sales:write");
  const { customers, varieties, fill } = await quotationFormData();
  const pk = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, { packaging: v.packaging }]));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New sales order" crumbs={[{ label: "Sales & Orders", href: "/orders" }, { label: "New" }]} description="Orders are created as drafts. Confirming reserves inventory (FEFO/FIFO)." />
      <OrderForm id={null} customers={customers} varieties={varieties} fill={pk} defaults={{ customerId: customers[0]?.value, orderDate: businessDate(), currency: "USD", exchangeRate: 1, incoterm: "FOB", headerDiscount: 0, items: [{ varietyId: varieties[0]?.value, grade: "CLASS_I", packaging: "", quantityKg: "", unitPrice: "", discountPct: 0 }] }} />
    </div>
  );
}
