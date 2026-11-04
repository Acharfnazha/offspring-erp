"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { invoiceSchema } from "@/lib/schemas";
import { parseDateOnly } from "@/lib/dates";
import { cancelInvoice, createCreditNote, createInvoice, issueInvoice } from "@/lib/services/finance";

export async function createInvoiceAction(values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("finance:write");
    const v = invoiceSchema.parse(values);
    const issue = !!(values as { issueNow?: boolean }).issueNow;
    const inv = await prisma.$transaction((tx) => createInvoice(tx, { ...v, customerId: v.type === "PURCHASE" ? null : v.customerId, supplierId: v.type === "PURCHASE" ? v.supplierId : null, issueDate: parseDateOnly(v.issueDate), dueDate: parseDateOnly(v.dueDate), issue }, user.id));
    revalidatePath("/invoices");
    return { id: inv.id };
  }, "Invoice created");
}

export async function issueInvoiceAction(id: string) {
  return runAction(async () => {
    const user = await assertPermission("finance:write");
    await prisma.$transaction((tx) => issueInvoice(tx, id, user.id));
    revalidatePath(`/invoices/${id}`);
  }, "Invoice issued");
}

export async function cancelInvoiceAction(id: string, reason?: string) {
  return runAction(async () => {
    const user = await assertPermission("finance:write");
    await prisma.$transaction((tx) => cancelInvoice(tx, id, user.id, reason || "Cancelled"));
    revalidatePath(`/invoices/${id}`);
  }, "Invoice cancelled");
}

export async function creditNoteAction(id: string, values: Record<string, string>) {
  return runAction(async () => {
    const user = await assertPermission("finance:write");
    const cn = await prisma.$transaction((tx) => createCreditNote(tx, id, values.amount, values.reason || "Credit", user.id));
    revalidatePath(`/invoices/${id}`);
    return { id: cn.id };
  }, "Credit note issued and applied");
}
