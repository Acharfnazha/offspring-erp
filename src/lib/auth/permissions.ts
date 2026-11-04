import type { Role } from "@prisma/client";

export const PERMISSIONS = {
  "inventory:read": "View inventory batches and movements",
  "inventory:write": "Receive, transfer, reserve, dispatch and adjust inventory",
  "storage:read": "View cold rooms and storage contracts",
  "storage:write": "Manage cold rooms, readings and storage contracts",
  "storage:billing": "Generate storage invoices and adjustments",
  "customers:read": "View customers and CRM pipeline",
  "customers:write": "Create and edit customers",
  "suppliers:read": "View suppliers and purchase orders",
  "suppliers:write": "Manage suppliers, purchase orders and goods receipts",
  "sales:read": "View sales orders",
  "sales:write": "Create and manage sales orders",
  "sales:override": "Confirm orders beyond available inventory (recorded override)",
  "quotations:read": "View quotations",
  "quotations:write": "Create and manage quotations",
  "shipments:read": "View shipments",
  "shipments:write": "Create and manage shipments",
  "finance:read": "View invoices, payments, balances and statements",
  "finance:write": "Create invoices and record payments",
  "expenses:read": "View expenses",
  "expenses:write": "Submit expenses",
  "expenses:approve": "Approve or reject expenses",
  "profit:use": "Use the profit calculator",
  "analytics:read": "View operational analytics",
  "analytics:finance": "View financial analytics (revenue, profit, receivables)",
  "documents:read": "View and download general documents",
  "documents:write": "Upload and archive documents",
  "documents:finance": "Access finance-restricted documents",
  "documents:management": "Access management-restricted documents",
  "ai:use": "Use the AI business assistant",
  "users:manage": "Manage employees, roles and account status",
  "settings:manage": "Change application settings",
  "audit:read": "View audit logs",
} as const;

export type Permission = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as Permission[];

const READ_OPS: Permission[] = [
  "inventory:read",
  "storage:read",
  "customers:read",
  "suppliers:read",
  "sales:read",
  "quotations:read",
  "shipments:read",
  "documents:read",
  "analytics:read",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ALL.filter((p) => p !== "documents:management" || true),
  ACCOUNTANT: [
    ...READ_OPS,
    "finance:read",
    "finance:write",
    "expenses:read",
    "expenses:write",
    "expenses:approve",
    "storage:billing",
    "analytics:finance",
    "documents:write",
    "documents:finance",
    "profit:use",
    "ai:use",
    "audit:read",
  ],
  WAREHOUSE_MANAGER: [
    ...READ_OPS,
    "inventory:write",
    "storage:write",
    "suppliers:write",
    "expenses:read",
    "expenses:write",
    "documents:write",
    "ai:use",
  ],
  SALES_MANAGER: [
    ...READ_OPS,
    "customers:write",
    "quotations:write",
    "sales:write",
    "sales:override",
    "finance:read",
    "profit:use",
    "documents:write",
    "ai:use",
  ],
  LOGISTICS_MANAGER: [
    ...READ_OPS,
    "shipments:write",
    "expenses:read",
    "expenses:write",
    "documents:write",
    "profit:use",
    "ai:use",
  ],
  EMPLOYEE: ["inventory:read", "storage:read", "customers:read", "shipments:read", "documents:read", "expenses:write", "ai:use"],
  VIEWER: READ_OPS,
};

export function hasPermission(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  ACCOUNTANT: "Accountant",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  SALES_MANAGER: "Sales Manager",
  LOGISTICS_MANAGER: "Logistics Manager",
  EMPLOYEE: "Employee",
  VIEWER: "Read-Only Viewer",
};

/** Only a Super Admin may grant Super Admin; Admins may manage all other roles. */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (actor === "SUPER_ADMIN") return true;
  if (actor === "ADMIN") return target !== "SUPER_ADMIN";
  return false;
}
