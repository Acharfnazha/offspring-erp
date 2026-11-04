"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { BusinessError } from "@/lib/errors";
import { quotationSchema } from "@/lib/schemas";
import { audit } from "@/lib/audit";
import { convertQuotationToOrder, createQuotation, reviseQuotation } from "@/lib/services/quotations";

export async function saveQuotationAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("quotations:write");
    const v = quotationSchema.parse(values);
    const q = await prisma.$transaction((tx) => (id ? reviseQuotation(tx, id, v, user.id) : createQuotation(tx, v, user.id)));
    revalidatePath("/quotations");
    return { id: q.id };
  }, id ? "New revision saved" : "Quotation created");
}

export async function setQuotationStatusAction(id: string, status: string) {
  return runAction(async () => {
    const user = await assertPermission("quotations:write");
    const s = z.enum(["SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).parse(status);
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id } });
    if (q.status === "CONVERTED") throw new BusinessError("Converted quotations cannot change status");
    await prisma.quotation.update({ where: { id }, data: { status: s } });
    await audit({ userId: user.id, action: `quotation.${s.toLowerCase()}`, entity: "Quotation", entityId: id, summary: `${q.quoteNo} marked ${s.toLowerCase()}` });
    revalidatePath(`/quotations/${id}`);
  }, "Quotation updated");
}

export async function convertQuotationAction(id: string) {
  return runAction(async () => {
    const user = await assertPermission("sales:write");
    const o = await prisma.$transaction((tx) => convertQuotationToOrder(tx, id, user.id));
    revalidatePath("/orders");
    return { id: o.id };
  }, "Sales order created from quotation");
}
