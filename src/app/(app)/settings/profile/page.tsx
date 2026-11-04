import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { PageHeader, Field } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/forms/action-dialog";
import { ActionButton } from "@/components/forms/action-button";
import { formatDateTime } from "@/lib/dates";
import { changePasswordAction, signOutOtherSessionsAction } from "../actions";

export default async function ProfilePage() {
  const me = await requireUser();
  const sessions = await prisma.session.findMany({ where: { userId: me.id }, orderBy: { lastSeenAt: "desc" } });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="My profile" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Profile" }]} />
      <Card><CardHeader><CardTitle>Account</CardTitle></CardHeader><CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3"><Field label="Name">{me.name}</Field><Field label="Email">{me.email}</Field><Field label="Role">{ROLE_LABELS[me.role]}</Field><Field label="Job title">{me.jobTitle}</Field></dl>
        <div className="flex flex-wrap gap-1">{ROLE_PERMISSIONS[me.role].map((p) => <Badge key={p} variant="muted" className="font-mono">{p}</Badge>)}</div>
        <ActionDialog trigger={<Button variant="outline">Change password</Button>} title="Change password" fields={[{ name: "current", label: "Current password", type: "text", required: true }, { name: "next", label: "New password (min 10, upper, lower, digit)", required: true }, { name: "confirm", label: "Confirm new password", required: true }]} onSubmit={changePasswordAction} />
      </CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Active sessions</CardTitle>{sessions.length > 1 && <ActionButton action={signOutOtherSessionsAction} confirmTitle="Sign out all other sessions?">Sign out others</ActionButton>}</CardHeader><CardContent>
        <ul className="divide-y text-sm">{sessions.map((s, i) => <li key={s.id} className="flex justify-between gap-2 py-2"><span className="truncate">{s.userAgent?.slice(0, 70) ?? "Unknown device"} {i === 0 && <Badge variant="success">current</Badge>}</span><span className="shrink-0 text-xs text-muted-foreground">{s.ip ?? ""} · {formatDateTime(s.lastSeenAt)}</span></li>)}</ul>
      </CardContent></Card>
    </div>
  );
}
