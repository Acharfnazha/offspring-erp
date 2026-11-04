"use client";
import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar, type TopbarNotification } from "./topbar";
import type { NavKey } from "./nav-config";

export function AppShell({ children, allowed, user, notifications, quickCreate }: {
  children: React.ReactNode;
  allowed: NavKey[];
  user: { name: string; email: string; roleLabel: string };
  notifications: TopbarNotification[];
  quickCreate: { label: string; href: string }[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar allowed={allowed} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} notifications={notifications} quickCreate={quickCreate} onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
