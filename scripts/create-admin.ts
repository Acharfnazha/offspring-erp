/* eslint-disable no-console */
// Creates (or promotes) a Super Admin without loading demo data, and prints a one-time password-set link.
// Usage: npx tsx scripts/create-admin.ts admin@example.com "Full Name"
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/auth/permissions";

const prisma = new PrismaClient();

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Usage: npx tsx scripts/create-admin.ts <email> "<full name>"');
  const normalized = email.trim().toLowerCase();
  // Keep the permission catalogue in sync (idempotent)
  for (const [key, description] of Object.entries(PERMISSIONS)) await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS))
    for (const p of perms) await prisma.rolePermission.upsert({ where: { role_permissionKey: { role: role as never, permissionKey: p } }, create: { role: role as never, permissionKey: p }, update: {} });

  const passwordHash = await bcrypt.hash(randomBytes(24).toString("base64url"), 12);
  const user = await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name: name || "Administrator", role: "SUPER_ADMIN", passwordHash },
    update: { role: "SUPER_ADMIN", active: true },
  });
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
  await prisma.auditLog.create({ data: { action: "user.bootstrap_admin", entity: "User", entityId: user.id, summary: `Super Admin ${normalized} created via CLI` } });
  console.log(`Super Admin ready: ${normalized}`);
  console.log(`Set the password within 1 hour: ${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
