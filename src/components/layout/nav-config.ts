import type { Permission } from "@/lib/auth/permissions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type NavKey = keyof Dictionary["nav"];
export interface NavItem {
  key: NavKey;
  href: string;
  icon: string;
  perm?: Permission;
  group: keyof Dictionary["groups"];
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", href: "/dashboard", icon: "LayoutDashboard", group: "operations" },
  { key: "inventory", href: "/inventory", icon: "Apple", perm: "inventory:read", group: "operations" },
  { key: "coldStorage", href: "/cold-storage", icon: "Snowflake", perm: "storage:read", group: "operations" },
  { key: "customers", href: "/customers", icon: "Users", perm: "customers:read", group: "commercial" },
  { key: "suppliers", href: "/suppliers", icon: "Tractor", perm: "suppliers:read", group: "commercial" },
  { key: "orders", href: "/orders", icon: "ShoppingCart", perm: "sales:read", group: "commercial" },
  { key: "shipments", href: "/shipments", icon: "Ship", perm: "shipments:read", group: "commercial" },
  { key: "quotations", href: "/quotations", icon: "FileText", perm: "quotations:read", group: "commercial" },
  { key: "invoices", href: "/invoices", icon: "Receipt", perm: "finance:read", group: "finance" },
  { key: "payments", href: "/payments", icon: "Wallet", perm: "finance:read", group: "finance" },
  { key: "expenses", href: "/expenses", icon: "CreditCard", perm: "expenses:read", group: "finance" },
  { key: "profit", href: "/profit-calculator", icon: "Calculator", perm: "profit:use", group: "finance" },
  { key: "analytics", href: "/analytics", icon: "BarChart3", perm: "analytics:read", group: "intelligence" },
  { key: "assistant", href: "/assistant", icon: "Sparkles", perm: "ai:use", group: "intelligence" },
  { key: "documents", href: "/documents", icon: "FolderOpen", perm: "documents:read", group: "intelligence" },
  { key: "employees", href: "/employees", icon: "UserCog", perm: "users:manage", group: "admin" },
  { key: "settings", href: "/settings", icon: "Settings", group: "admin" },
];
