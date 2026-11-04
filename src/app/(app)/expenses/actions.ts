"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { BusinessError } from "@/lib/errors";
import { expenseSchema } from "@/lib/schemas";
import { parseDateOnly } from "@/lib/dates";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";

export async function saveExpenseAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("expenses:write");
    const v = expenseSchema.parse(values);
    const data = { ...v, amount: v.amount.toFixed(2), date: parseDateOnly(v.date), shipmentId: v.shipmentId || null };
    if (id) {
      const e = await prisma.expense.findUniqueOrThrow({ where: { id } });
      if (e.status !== "PENDING" && e.status !== "REJECTED") throw new BusinessError("Approved or paid expenses cannot be edited");
      await prisma.expense.update({ where: { id }, data: { ...data, status: "PENDING" } });
      await audit({ userId: user.id, action: "expense.update", entity: "Expense", entityId: id, before: e, after: data });
      return { id };
    }
    const e = await prisma.$transaction(async (tx) => tx.expense.create({ data: { ...data, expenseNo: await nextNumber(tx, "EXP"), createdById: user.id } }));
    await audit({ userId: user.id, action: "expense.create", entity: "Expense", entityId: e.id, summary: `${e.expenseNo} ${e.amount} ${e.currency}` });
    revalidatePath("/expenses");
    return { id: e.id };
  }, "Expense saved");
}

export async function setExpenseStatusAction(id: string, status: "APPROVED" | "REJECTED" | "PAID", note?: string) {
  return runAction(async () => {
    const user = await assertPermission("expenses:approve");
    const e = await prisma.expense.findUniqueOrThrow({ where: { id } });
    if (e.createdById === user.id && status === "APPROVED" && user.role !== "SUPER_ADMIN") throw new BusinessError("Segregation of duties: you cannot approve your own expense");
    const allowed: Record<string, string[]> = { APPROVED: ["PENDING", "REJECTED"], REJECTED: ["PENDING"], PAID: ["APPROVED"] };
    if (!allowed[status].includes(e.status)) throw new BusinessError(`Cannot change a ${e.status.toLowerCase()} expense to ${status.toLowerCase()}`);
    await prisma.expense.update({ where: { id }, data: { status, ...(status !== "PAID" ? { approvedById: user.id, approvedAt: new Date() } : {}), notes: note ? `${e.notes ?? ""}\n${status}: ${note}`.trim() : e.notes } });
    await audit({ userId: user.id, action: `expense.${status.toLowerCase()}`, entity: "Expense", entityId: id, summary: `${e.expenseNo} ${status.toLowerCase()}` });
    revalidatePath(`/expenses/${id}`);
  }, `Expense ${status.toLowerCase()}`);
}

export async function archiveExpenseAction(id: string) {
  return runAction(async () => {
    const user = await assertPermission("expenses:approve");
    await prisma.expense.update({ where: { id }, data: { archivedAt: new Date() } });
    await audit({ userId: user.id, action: "expense.archive", entity: "Expense", entityId: id });
  }, "Expense archived");
}
