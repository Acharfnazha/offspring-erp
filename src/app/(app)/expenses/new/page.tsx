import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EntityForm } from "@/components/forms/entity-form";
import { businessDate } from "@/lib/dates";
import { saveExpenseAction } from "../actions";
import { expenseFields } from "../expense-fields";

export default async function NewExpensePage() {
  await requireUser("expenses:write");
  const ships = (await prisma.shipment.findMany({ orderBy: { createdAt: "desc" }, take: 50 })).map((s) => ({ value: s.id, label: s.shipmentNo }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New expense" crumbs={[{ label: "Expenses", href: "/expenses" }, { label: "New" }]} description="Submitted as pending; an approver must approve it. Attach receipts on the expense page." />
      <Card><CardContent className="pt-5"><EntityForm schema="expense" action={saveExpenseAction.bind(null, null)} redirectTo="/expenses/:id" submitLabel="Submit expense" fields={expenseFields(ships)} defaultValues={{ category: "OTHER", date: businessDate(), description: "", amount: "", currency: "USD", shipmentId: "" }} /></CardContent></Card>
    </div>
  );
}
