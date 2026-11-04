"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Apple, Snowflake, Users, Tractor, ShoppingCart, Ship, FileText, Receipt, Wallet, CreditCard, Calculator,
  BarChart3, Sparkles, FolderOpen, UserCog, Settings, ChevronsLeft, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { NAV_ITEMS, type NavKey } from "./nav-config";

const ICONS: Record<string, LucideIcon> = { LayoutDashboard, Apple, Snowflake, Users, Tractor, ShoppingCart, Ship, FileText, Receipt, Wallet, CreditCard, Calculator, BarChart3, Sparkles, FolderOpen, UserCog, Settings };

export function Sidebar({ allowed, mobileOpen, onMobileClose }: { allowed: NavKey[]; mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const { dict } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("ofs_sidebar") === "1"); } catch {}
  }, []);
  useEffect(() => { onMobileClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("ofs_sidebar", c ? "0" : "1"); } catch {}
      return !c;
    });
  };
  const items = NAV_ITEMS.filter((i) => allowed.includes(i.key));
  const groups = Array.from(new Set(items.map((i) => i.group)));

  const content = (isMobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2.5 px-4", collapsed && !isMobile && "justify-center px-0")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 text-sm font-bold text-white shadow-inner">O</div>
        {(!collapsed || isMobile) && (
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">OFFSPRING</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-muted">ERP Platform</div>
          </div>
        )}
        {isMobile && (
          <button onClick={onMobileClose} className="ms-auto rounded-md p-1.5 hover:bg-sidebar-accent" aria-label="Close menu"><X className="h-4 w-4" /></button>
        )}
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => (
          <div key={g} className="mt-3">
            {(!collapsed || isMobile) && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">{dict.groups[g]}</div>}
            {items.filter((i) => i.group === g).map((item) => {
              const Icon = ICONS[item.icon];
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  title={collapsed && !isMobile ? dict.nav[item.key] : undefined}
                  className={cn(
                    "group relative mt-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    active && "bg-sidebar-accent text-white font-medium",
                    collapsed && !isMobile && "justify-center px-0",
                  )}
                >
                  {active && <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-emerald-400" />}
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-400" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
                  {(!collapsed || isMobile) && <span className="truncate">{dict.nav[item.key]}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {!isMobile && (
        <button onClick={toggle} className="m-2 flex items-center justify-center gap-2 rounded-md py-2 text-xs text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Toggle sidebar">
          <ChevronsLeft className={cn("h-4 w-4 transition-transform rtl:rotate-180", collapsed && "rotate-180 rtl:rotate-0")} />
          {!collapsed && dict.common.collapse}
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside className={cn("no-print sticky top-0 hidden h-screen shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:block", collapsed ? "w-[68px]" : "w-60")}>{content(false)}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-sidebar text-sidebar-foreground shadow-2xl">{content(true)}</aside>
        </div>
      )}
    </>
  );
}
