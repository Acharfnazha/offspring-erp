import "server-only";
import { prisma } from "@/lib/db";
import { hashToken, newToken } from "./tokens";

/** Issues a single-use password reset token valid for 1 hour. NOT a server action — never export from a "use server" file. */
export async function issueResetToken(userId: string) {
  const token = newToken();
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  return `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
}
