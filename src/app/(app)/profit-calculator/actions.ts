"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { calculateProfit, profitInputSchema } from "@/lib/profit";
import { audit } from "@/lib/audit";

export async function saveCalculationAction(name: string, inputs: unknown) {
  return runAction(async () => {
    const user = await assertPermission("profit:use");
    const n = z.string().trim().min(2, "Name the calculation").max(120).parse(name);
    const i = profitInputSchema.parse(inputs);
    const outputs = calculateProfit(i); // recomputed server-side; client values are never trusted
    const c = await prisma.profitCalculation.create({ data: { name: n, inputs: i, outputs: outputs as unknown as object, createdById: user.id } });
    await audit({ userId: user.id, action: "profit.save", entity: "ProfitCalculation", entityId: c.id, summary: n });
    revalidatePath("/profit-calculator");
    return { id: c.id };
  }, "Calculation saved");
}

export async function deleteCalculationAction(id: string) {
  return runAction(async () => {
    const user = await assertPermission("profit:use");
    const c = await prisma.profitCalculation.findUniqueOrThrow({ where: { id } });
    if (c.createdById !== user.id && !["SUPER_ADMIN", "ADMIN"].includes(user.role)) throw new Error("You cannot delete another user's calculation");
    await prisma.profitCalculation.delete({ where: { id } });
    revalidatePath("/profit-calculator");
  }, "Calculation deleted");
}
