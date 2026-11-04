"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { issueResetToken } from "@/lib/auth/reset";
import { audit } from "@/lib/audit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1).max(200), next: z.string().optional() }).safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  const generic = { error: "Invalid email or password." };
  if (!user) {
    await verifyPassword(password, "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.3ZuY4u9Rdd5sGg8ZsqvYJ6U6O7m6").catch(() => false); // timing equalization
    return generic;
  }
  if (!user.active) return { error: "This account is deactivated. Contact an administrator." };
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: `Too many failed attempts. Try again after ${user.lockedUntil.toISOString().slice(11, 16)} UTC.` };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: failed >= MAX_FAILED ? 0 : failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null },
    });
    await audit({ userId: user.id, action: "auth.login_failed", entity: "User", entityId: user.id });
    return generic;
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id });
  const next = parsed.data.next && parsed.data.next.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";
  redirect(next);
}

/** Issues a single-use reset token (1h). Without an email service configured, the link is written to the server log. */
export async function requestPasswordResetAction(_prev: { done?: boolean } | undefined, formData: FormData): Promise<{ done?: boolean }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user && user.active) {
    const link = await issueResetToken(user.id);
    console.info(`[password-reset] Reset link for ${email}: ${link}`);
  }
  return { done: true }; // never reveal whether the account exists
}

export async function resetPasswordAction(_prev: { error?: string; done?: boolean } | undefined, formData: FormData): Promise<{ error?: string; done?: boolean }> {
  const token = String(formData.get("token") ?? "");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pw !== confirm) return { error: "Passwords do not match." };
  const check = passwordSchema.safeParse(pw);
  if (!check.success) return { error: check.error.issues[0].message };
  const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return { error: "This reset link is invalid or has expired." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: rec.userId } }),
  ]);
  await audit({ userId: rec.userId, action: "auth.password_reset", entity: "User", entityId: rec.userId });
  return { done: true };
}
