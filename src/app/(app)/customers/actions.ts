"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { customerSchema, PIPELINE } from "@/lib/schemas";
import { parseDateOnly } from "@/lib/dates";
import { nextNumber } from "@/lib/numbering";
import { audit } from "@/lib/audit";
import { z } from "zod";

export async function saveCustomerAction(id: string | null, values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("customers:write");
    const v = customerSchema.parse(values);
    const data = { ...v, nextFollowUpAt: v.nextFollowUpAt ? parseDateOnly(v.nextFollowUpAt) : null, creditLimit: v.creditLimit.toFixed(2) };
    if (id) {
      const before = await prisma.customer.findUniqueOrThrow({ where: { id } });
      const c = await prisma.customer.update({ where: { id }, data });
      await audit({ userId: user.id, action: "customer.update", entity: "Customer", entityId: id, summary: `Updated ${c.companyName}`, before, after: c });
      revalidatePath(`/customers/${id}`);
      return { id };
    }
    const c = await prisma.$transaction(async (tx) => tx.customer.create({ data: { ...data, code: await nextNumber(tx, "CUS", { year: false, pad: 4 }) } }));
    await audit({ userId: user.id, action: "customer.create", entity: "Customer", entityId: c.id, summary: `Created customer ${c.companyName}` });
    revalidatePath("/customers");
    return { id: c.id };
  }, "Customer saved");
}

export async function setStageAction(id: string, stage: string) {
  return runAction(async () => {
    const user = await assertPermission("customers:write");
    const s = z.enum(PIPELINE).parse(stage);
    const c = await prisma.customer.update({ where: { id }, data: { pipelineStage: s } });
    await audit({ userId: user.id, action: "customer.stage", entity: "Customer", entityId: id, summary: `${c.companyName} → ${s}` });
    revalidatePath("/customers/pipeline");
  }, "Stage updated");
}

export async function setFollowUpAction(id: string, date?: string) {
  return runAction(async () => {
    await assertPermission("customers:write");
    await prisma.customer.update({ where: { id }, data: { nextFollowUpAt: date ? parseDateOnly(date) : null } });
    revalidatePath(`/customers/${id}`);
  }, "Follow-up reminder set");
}

export async function archiveCustomerAction(id: string, archive: boolean) {
  return runAction(async () => {
    const user = await assertPermission("customers:write");
    const c = await prisma.customer.update({ where: { id }, data: { archivedAt: archive ? new Date() : null } });
    await audit({ userId: user.id, action: archive ? "customer.archive" : "customer.restore", entity: "Customer", entityId: id, summary: `${archive ? "Archived" : "Restored"} ${c.companyName}` });
    revalidatePath("/customers");
  }, archive ? "Customer archived" : "Customer restored");
}
