"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { Bell, Languages, Menu, Moon, Plus, Search, Sun, Monitor, LogOut, User as UserIcon, AlertTriangle, Info, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/client";
import { logoutAction, markNotificationsReadAction, setLocaleAction } from "@/server/shell-actions";
import { cn } from "@/lib/utils";

export interface TopbarNotification { id: string; title: string; body: string | null; link: string | null; severity: string; createdAt: string; }

export function Topbar({ user, notifications, quickCreate, onMenu }: {
  user: { name: string; email: string; roleLabel: string };
  notifications: TopbarNotification[];
  quickCreate: { label: string; href: string }[];
  onMenu: () => void;
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [q, setQ] = useState("");
  const [, startTransition] = useTransition();
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu /></Button>
      <form
        className="relative flex-1 max-w-xl"
        onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}
        role="search"
      >
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={dict.common.searchEverything}
          aria-label="Global search"
          className="h-9 w-full rounded-lg border bg-muted/50 ps-9 pe-3 text-sm outline-none transition focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30"
        />
      </form>
      <div className="ms-auto flex items-center gap-1">
        {quickCreate.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus /><span className="hidden sm:inline">{dict.common.create}</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{dict.quick.title}</DropdownMenuLabel>
              {quickCreate.map((q) => (
                <DropdownMenuItem key={q.href} onSelect={() => router.push(q.href)}>{q.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={dict.common.notifications} className="relative">
              <Bell />
              {notifications.length > 0 && <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{notifications.length > 9 ? "9+" : notifications.length}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">{dict.common.notifications}</span>
              {notifications.length > 0 && (
                <button className="text-xs text-primary hover:underline" onClick={() => startTransition(() => markNotificationsReadAction())}>{dict.common.markAllRead}</button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">{dict.common.noNotifications}</div>}
              {notifications.map((n) => {
                const Icon = n.severity === "critical" ? CircleAlert : n.severity === "warning" ? AlertTriangle : Info;
                return (
                  <DropdownMenuItem
                    key={n.id}
                    className="items-start gap-2.5 rounded-none border-b px-3 py-2.5 last:border-0"
                    onSelect={() => { startTransition(() => markNotificationsReadAction([n.id])); if (n.link) router.push(n.link); }}
                  >
                    <Icon className={cn("mt-0.5", n.severity === "critical" ? "text-red-500" : n.severity === "warning" ? "text-amber-500" : "text-sky-500")} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium leading-snug">{n.title}</div>
                      {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" aria-label={dict.common.language} title={locale === "en" ? "العربية" : "English"}
          onClick={() => startTransition(async () => { await setLocaleAction(locale === "en" ? "ar" : "en"); router.refresh(); })}>
          <Languages />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={dict.common.theme}><Sun className="dark:hidden" /><Moon className="hidden dark:block" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setTheme("light")} className={cn(theme === "light" && "font-semibold")}><Sun />{dict.common.light}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")} className={cn(theme === "dark" && "font-semibold")}><Moon />{dict.common.dark}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")} className={cn(theme === "system" && "font-semibold")}><Monitor />{dict.common.system}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ms-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-800 text-xs font-semibold text-white ring-2 ring-background" aria-label="User menu">{initials}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2 py-2">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
              <div className="mt-1 text-[11px] font-medium text-primary">{user.roleLabel}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/settings/profile"><UserIcon />{dict.common.profile}</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => startTransition(() => logoutAction())} className="text-red-600 focus:text-red-600"><LogOut />{dict.common.signOut}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
