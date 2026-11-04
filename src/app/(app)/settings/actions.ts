"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, getCurrentUser } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { AuthError, BusinessError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";

const num = z.coerce.number().finite();
const SCHEMAS: Record<string, z.ZodTypeAny> = {
  company: z.object({ name: z.string().min(2).max(120), address: z.string().max(200).default(""), phone: z.string().max(60).default(""), email: z.string().max(120).default(""), website: z.string().max(120).default(""), taxId: z.string().max(60).default(""), bank: z.string().max(500).default("") }),
  storageBilling: z.object({ ratePerKgMonth: z.string().regex(/^\d+(\.\d{1,4})?$/, "Up to 4 decimals"), minimumPeriods: z.coerce.number().int().min(0).max(12) }),
  exchangeRates: z.record(z.string().regex(/^[A-Z]{3}$/), num.positive()).refine((r) => r.USD === 1, "USD rate must be 1"),
  packagingDefaults: z.object({ cartonWeightKg: num.positive(), laborPerCarton: num.min(0), items: z.array(z.object({ name: z.string().min(1).max(80), costPerCarton: num.min(0) })).max(20) }),
  inventory: z.object({ allocationStrategy: z.enum(["FEFO", "FIFO"]), expiryAlertDays: z.coerce.number().int().min(1).max(60) }),
};

export async function saveSettingAction(key: string, value: unknown) {
  return runAction(async () => {
    const user = await assertPermission("settings:manage");
    const schema = SCHEMAS[key];
    if (!schema) throw new BusinessError("Unknown setting");
    const v = schema.parse(value);
    const before = await prisma.setting.findUnique({ where: { key } });
    await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
    await audit({ userId: user.id, action: "settings.update", entity: "Setting", entityId: key, before: before?.value, after: v });
    revalidatePath("/settings");
  }, "Settings saved");
}

export async function changePasswordAction(values: Record<string, string>) {
  return runAction(async () => {
    const me = await getCurrentUser();
    if (!me) throw new AuthError("Session expired");
    if (values.next !== values.confirm) throw new BusinessError("New passwords do not match");
    const pw = passwordSchema.safeParse(values.next);
    if (!pw.success) throw new BusinessError(pw.error.issues[0].message);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(values.current ?? "", u.passwordHash))) throw new BusinessError("Current password is incorrect");
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(values.next) } });
    await audit({ userId: me.id, action: "auth.password_change", entity: "User", entityId: me.id });
  }, "Password changed");
}

export async function signOutOtherSessionsAction() {
  return runAction(async () => {
    const me = await getCurrentUser();
    if (!me) throw new AuthError("Session expired");
    const sessions = await prisma.session.findMany({ where: { userId: me.id }, orderBy: { lastSeenAt: "desc" } });
    const keep = sessions[0]?.id;
    const r = await prisma.session.deleteMany({ where: { userId: me.id, id: { not: keep } } });
    return { count: r.count };
  }, "Other sessions signed out");
}
