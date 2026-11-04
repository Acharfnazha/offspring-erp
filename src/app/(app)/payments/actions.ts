"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { paymentSchema } from "@/lib/schemas";
import { parseDateOnly } from "@/lib/dates";
import { allocate, recordPayment, voidPayment } from "@/lib/services/finance";

export async function recordPaymentAction(values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("finance:write");
    const v = paymentSchema.parse(values);
    const p = await prisma.$transaction((tx) => recordPayment(tx, { ...v, paidAt: parseDateOnly(v.paidAt), customerId: v.direction === "INCOMING" ? v.customerId : null, supplierId: v.direction === "OUTGOING" ? v.supplierId : null }, user.id), { isolationLevel: "Serializable" });
    revalidatePath("/payments");
    revalidatePath("/invoices");
    return { id: p.id };
  }, "Payment recorded");
}

export async function allocatePaymentAction(paymentId: string, values: Record<string, string>) {
  return runAction(async () => {
    await assertPermission("finance:write");
    const v = z.object({ invoiceId: z.string().min(1), amount: z.coerce.number().positive() }).parse(values);
    await prisma.$transaction((tx) => allocate(tx, paymentId, v.invoiceId, v.amount), { isolationLevel: "Serializable" });
    revalidatePath(`/payments/${paymentId}`);
  }, "Payment allocated");
}

export async function voidPaymentAction(paymentId: string, reason?: string) {
  return runAction(async () => {
    const user = await assertPermission("finance:write");
    await prisma.$transaction((tx) => voidPayment(tx, paymentId, user.id, reason || "Voided"));
    revalidatePath(`/payments/${paymentId}`);
  }, "Payment voided; invoice balances restored");
}
