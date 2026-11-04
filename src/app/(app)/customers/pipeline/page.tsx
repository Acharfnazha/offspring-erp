import Link from "next/link";
import { List } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PIPELINE } from "@/lib/schemas";
import { isoDate, todayDate } from "@/lib/dates";
import { D } from "@/lib/money";
import { PipelineBoard } from "./board";

export const metadata = { title: "Sales pipeline" };

export default async function PipelinePage() {
  const user = await requireUser("customers:read");
  const today = todayDate();
  const customers = await prisma.customer.findMany({ where: { archivedAt: null }, include: { invoices: { where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } } }, orderBy: { companyName: "asc" } });
  return (
    <div>
      <PageHeader title="Sales pipeline" description="Drag cards between stages. Follow-up reminders appear in notifications." actions={<Button variant="outline" asChild><Link href="/customers"><List />Table view</Link></Button>} />
      <PipelineBoard
        stages={PIPELINE}
        canEdit={can(user, "customers:write")}
        cards={customers.map((c) => ({ id: c.id, name: c.companyName, country: c.country, stage: c.pipelineStage, followUp: c.nextFollowUpAt ? isoDate(c.nextFollowUpAt) : null, overdue: !!c.nextFollowUpAt && c.nextFollowUpAt < today, openValue: can(user, "finance:read") ? c.invoices.reduce((a, i) => a.plus(D(i.total).minus(D(i.amountPaid))), D(0)).toFixed(2) : "0" }))}
      />
    </div>
  );
}
