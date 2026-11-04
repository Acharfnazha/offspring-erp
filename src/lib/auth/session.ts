import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasPermission, type Permission } from "./permissions";
import { hashToken, newToken } from "./tokens";
import { AuthError } from "@/lib/errors";

export const SESSION_COOKIE = "ofs_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h sliding

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  jobTitle: string | null;
}

export async function createSession(userId: string) {
  const token = newToken();
  const h = await headers();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.active) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Sliding expiration (throttled to once per 5 minutes)
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) } })
      .catch(() => undefined);
  }
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role, locale: u.locale, jobTitle: u.jobTitle };
});

/** For pages: redirects to /login when unauthenticated, renders 403 page when unauthorized. */
export async function requireUser(perm?: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (perm && !hasPermission(user.role, perm)) redirect(`/forbidden?p=${encodeURIComponent(perm)}`);
  return user;
}

export { AuthError };

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertPermission(perm: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Your session has expired. Please sign in again.");
  if (!hasPermission(user.role, perm)) throw new AuthError("You do not have permission to perform this action.");
  return user;
}

export function can(user: SessionUser | null, perm: Permission): boolean {
  return !!user && hasPermission(user.role, perm);
}
