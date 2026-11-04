import { requireUser } from "@/lib/auth/session";
import { hasPermission, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { AppShell } from "@/components/layout/app-shell";
import { NAV_ITEMS } from "@/components/layout/nav-config";
import { generateAlerts, unreadNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { locale, dict } = await getDictionary();
  await generateAlerts().catch((e) => console.error("[alerts]", e));
  const notifications = await unreadNotifications(user);
  const allowed = NAV_ITEMS.filter((i) => !i.perm || hasPermission(user.role, i.perm)).map((i) => i.key);
  const qc: { label: string; href: string; perm: Permission }[] = [
    { label: dict.quick.batch, href: "/inventory/new", perm: "inventory:write" },
    { label: dict.quick.customer, href: "/customers/new", perm: "customers:write" },
    { label: dict.quick.quotation, href: "/quotations/new", perm: "quotations:write" },
    { label: dict.quick.order, href: "/orders/new", perm: "sales:write" },
    { label: dict.quick.shipment, href: "/shipments/new", perm: "shipments:write" },
    { label: dict.quick.invoice, href: "/invoices/new", perm: "finance:write" },
    { label: dict.quick.payment, href: "/payments/new", perm: "finance:write" },
    { label: dict.quick.expense, href: "/expenses/new", perm: "expenses:write" },
  ];
  return (
    <I18nProvider locale={locale} dict={dict}>
      <AppShell
        allowed={allowed}
        user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
        notifications={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, severity: n.severity, createdAt: n.createdAt.toISOString() }))}
        quickCreate={qc.filter((q) => hasPermission(user.role, q.perm)).map(({ label, href }) => ({ label, href }))}
      >
        {children}
      </AppShell>
    </I18nProvider>
  );
}
