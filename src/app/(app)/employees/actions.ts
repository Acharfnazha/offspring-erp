"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { canAssignRole } from "@/lib/auth/permissions";
import { runAction } from "@/lib/action";
import { BusinessError } from "@/lib/errors";
import { userSchema, ROLES } from "@/lib/schemas";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { issueResetToken } from "@/lib/auth/reset";

export async function createUserAction(values: unknown) {
  return runAction(async () => {
    const actor = await assertPermission("users:manage");
    const v = userSchema.parse(values);
    if (!canAssignRole(actor.role, v.role)) throw new BusinessError("You cannot assign this role");
    // Random unusable initial password; the employee sets their own via the one-time link.
    const u = await prisma.user.create({ data: { ...v, passwordHash: await hashPassword(randomBytes(24).toString("base64url")) } });
    const link = await issueResetToken(u.id);
    await audit({ userId: actor.id, action: "user.create", entity: "User", entityId: u.id, summary: `Created ${u.email} as ${u.role}` });
    revalidatePath("/employees");
    return { id: u.id, link };
  }, "Employee account created — share the one-time password link securely");
}

export async function updateUserAction(id: string, values: Record<string, string>) {
  return runAction(async () => {
    const actor = await assertPermission("users:manage");
    const v = z.object({ role: z.enum(ROLES), jobTitle: z.string().max(120).optional(), name: z.string().min(1).max(120) }).parse(values);
    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (!canAssignRole(actor.role, target.role) || !canAssignRole(actor.role, v.role)) throw new BusinessError("You cannot change this user's role");
    if (target.id === actor.id && v.role !== target.role) throw new BusinessError("You cannot change your own role");
    await prisma.user.update({ where: { id }, data: { role: v.role, jobTitle: v.jobTitle || null, name: v.name } });
    if (v.role !== target.role) await prisma.session.deleteMany({ where: { userId: id } });
    await audit({ userId: actor.id, action: "user.update", entity: "User", entityId: id, summary: `${target.email}: role ${target.role} → ${v.role}`, before: { role: target.role }, after: { role: v.role } });
    revalidatePath("/employees");
  }, "Employee updated");
}

export async function setActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    const actor = await assertPermission("users:manage");
    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.id === actor.id) throw new BusinessError("You cannot deactivate your own account");
    if (!canAssignRole(actor.role, target.role)) throw new BusinessError("You cannot modify this account");
    if (!active && target.role === "SUPER_ADMIN") {
      const others = await prisma.user.count({ where: { role: "SUPER_ADMIN", active: true, id: { not: id } } });
      if (others === 0) throw new BusinessError("At least one active Super Admin is required");
    }
    await prisma.user.update({ where: { id }, data: { active } });
    if (!active) await prisma.session.deleteMany({ where: { userId: id } });
    await audit({ userId: actor.id, action: active ? "user.activate" : "user.deactivate", entity: "User", entityId: id, summary: target.email });
    revalidatePath("/employees");
  }, active ? "Account reactivated" : "Account deactivated and signed out");
}

export async function resetLinkAction(id: string) {
  return runAction(async () => {
    const actor = await assertPermission("users:manage");
    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (!canAssignRole(actor.role, target.role)) throw new BusinessError("You cannot modify this account");
    const link = await issueResetToken(id);
    await audit({ userId: actor.id, action: "user.reset_link", entity: "User", entityId: id, summary: target.email });
    return { link };
  }, "One-time reset link generated (valid 1 hour)");
}
