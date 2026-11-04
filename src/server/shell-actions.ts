"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import { audit } from "@/lib/audit";
import { unreadNotifications } from "@/lib/services/notifications";

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit({ userId: user.id, action: "auth.logout", entity: "User", entityId: user.id });
  redirect("/login");
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
}

export async function markNotificationsReadAction(ids?: string[]) {
  const user = await getCurrentUser();
  if (!user) return;
  // Broadcast notifications are copied per-user on read so one user's read state does not affect others.
  const list = (await unreadNotifications(user, 200)).filter((n) => !ids || ids.includes(n.id));
  for (const n of list) {
    if (n.userId === user.id) await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
    else
      await prisma.notification.upsert({
        where: { dedupeKey: `${n.dedupeKey ?? n.id}:read:${user.id}` },
        create: { userId: user.id, type: "read-marker", title: n.title, dedupeKey: `${n.dedupeKey ?? n.id}:read:${user.id}`, readAt: new Date() },
        update: {},
      });
  }
  revalidatePath("/", "layout");
}
