import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendChart, DonutChart } from "@/components/charts/charts";
import { listParams, orderBy, str, type SP } from "@/lib/list-params";
import { EXPENSE_CATEGORIES, label, opts } from "@/lib/schemas";
import { D } from "@/lib/money";
import { parseDateOnly, todayDate } from "@/lib/dates";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("expenses:read");
  const sp = await searchParams;
  const lp = listParams(sp, ["expenseNo", "date", "amount", "category"], "date");
  const d = (s?: string) => { try { return s ? parseDateOnly(s) : undefined; } catch { return undefined; } };
  const where: Prisma.ExpenseWhereInput = {
    archivedAt: null,
    ...(lp.q ? { OR: [{ description: { contains: lp.q, mode: "insensitive" } }, { vendor: { contains: lp.q, mode: "insensitive" } }, { expenseNo: { contains: lp.q, mode: "insensitive" } }] } : {}),
    ...(str(sp, "category") ? { category: str(sp, "category") as never } : {}),
    ...(str(sp, "status") ? { status: str(sp, "status") as never } : {}),
    ...(d(str(sp, "from")) || d(str(sp, "to")) ? { date: { ...(d(str(sp, "from")) ? { gte: d(str(sp, "from")) } : {}), ...(d(str(sp, "to")) ? { lte: d(str(sp, "to")) } : {}) } } : {}),
  };
  const year = todayDate().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const [rows, total, monthly, byCat] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: orderBy(lp.sort, lp.dir), skip: lp.skip, take: lp.take }),
    prisma.expense.count({ where }),
    prisma.$queryRaw<{ m: number; v: string }[]>`SELECT EXTRACT(MONTH FROM date)::int m, SUM(amount)::text v FROM "Expense" WHERE "archivedAt" IS NULL AND status IN ('APPROVED','PAID') AND date >= ${yearStart} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ k: string; v: string }[]>`SELECT category::text k, SUM(amount)::text v FROM "Expense" WHERE "archivedAt" IS NULL AND status IN ('APPROVED','PAID') AND date >= ${yearStart} GROUP BY 1 ORDER BY 2::numeric DESC`,
  ]);
  const months = Array.from({ length: 12 }, (_, i) => ({ month: new Date(Date.UTC(year, i, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }), amount: Number(D(monthly.find((m) => m.m === i + 1)?.v).toFixed(2)) }));
  return (
    <div className="space-y-4">
      <PageHeader title="Expenses" description="Operating costs with receipts and approval workflow" actions={can(user, "expenses:write") && <Button asChild><Link href="/expenses/new"><Plus />New expense</Link></Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Monthly expenses {year}</CardTitle><CardDescription>Approved & paid</CardDescription></CardHeader><CardContent><TrendChart data={months} series={[{ key: "amount", name: "Expenses", type: "bar" }]} height={220} /></CardContent></Card>
        <Card><CardHeader><CardTitle>By category (YTD)</CardTitle><CardDescription>Yearly report</CardDescription></CardHeader><CardContent><DonutChart data={byCat.map((c) => ({ name: label(c.k), value: Number(c.v) }))} height={180} /></CardContent></Card>
      </div>
      <FilterBar placeholder="Description, vendor…" exportEntity="expenses" dateRange filters={[{ key: "category", label: "Category", options: opts(EXPENSE_CATEGORIES) }, { key: "status", label: "Status", options: opts(["PENDING", "APPROVED", "REJECTED", "PAID"]) }]} />
      <DataTable total={total} page={lp.page} pageSize={lp.pageSize} emptyTitle="No expenses"
        columns={[{ key: "no", header: "Expense", sortKey: "expenseNo", type: "mono" }, { key: "date", header: "Date", type: "date", sortKey: "date" }, { key: "category", header: "Category", sortKey: "category" }, { key: "desc", header: "Description" }, { key: "vendor", header: "Vendor", hideOnMobile: true }, { key: "amount", header: "Amount", type: "money", sortKey: "amount" }, { key: "status", header: "Status", type: "badge" }]}
        rows={rows.map((e) => ({ _href: `/expenses/${e.id}`, no: e.expenseNo, date: e.date.toISOString(), category: label(e.category), desc: e.description, vendor: e.vendor, amount: e.amount.toString(), _currency: e.currency, status: e.status }))} />
    </div>
  );
}
