import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { canAssignRole, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";
import { ROLES } from "@/lib/schemas";
import { EmployeeRowActions, NewEmployee } from "./employee-actions";
import { Check } from "lucide-react";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const me = await requireUser("users:manage");
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const roles = ROLES.filter((r) => canAssignRole(me.role, r)).map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const perms = Object.keys(PERMISSIONS) as Permission[];
  return (
    <div className="space-y-4">
      <PageHeader title="Employees & access" description="Accounts, roles and least-privilege permissions. All changes are audited." actions={<NewEmployee roles={roles} />} />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2 text-start">Employee</th><th className="px-4 py-2 text-start">Role</th><th className="hidden px-4 py-2 text-start md:table-cell">Last sign-in</th><th className="px-4 py-2 text-start">Status</th><th className="px-4 py-2 text-end">Actions</th></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-2.5"><div className="font-medium">{u.name}{u.id === me.id && <Badge variant="muted" className="ms-2">you</Badge>}</div><div className="text-xs text-muted-foreground">{u.email}{u.jobTitle ? ` · ${u.jobTitle}` : ""}</div></td>
                <td className="px-4 py-2.5"><Badge>{ROLE_LABELS[u.role]}</Badge></td>
                <td className="hidden px-4 py-2.5 text-xs md:table-cell">{formatDateTime(u.lastLoginAt)}</td>
                <td className="px-4 py-2.5"><StatusBadge status={u.active ? "ACTIVE" : "CANCELLED"} label={u.active ? "Active" : "Deactivated"} />{u.lockedUntil && u.lockedUntil > new Date() && <Badge variant="warning" className="ms-1">locked</Badge>}</td>
                <td className="px-4 py-2.5">{canAssignRole(me.role, u.role) && <EmployeeRowActions id={u.id} name={u.name} role={u.role} jobTitle={u.jobTitle ?? ""} active={u.active} roles={roles} self={u.id === me.id} />}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Role permission matrix</CardTitle><CardDescription>Enforced server-side on every page, action, export, document download and assistant query.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-y bg-muted/40"><tr><th className="sticky start-0 bg-muted/40 px-3 py-2 text-start">Permission</th>{ROLES.map((r) => <th key={r} className="whitespace-nowrap px-2 py-2 text-center font-medium">{ROLE_LABELS[r]}</th>)}</tr></thead>
            <tbody>{perms.map((p) => <tr key={p} className="border-b last:border-0"><td className="sticky start-0 bg-card px-3 py-1.5" title={PERMISSIONS[p]}><span className="font-mono">{p}</span></td>{ROLES.map((r) => <td key={r} className="text-center">{ROLE_PERMISSIONS[r].includes(p) ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" /> : <span className="text-muted-foreground/40">·</span>}</td>)}</tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
