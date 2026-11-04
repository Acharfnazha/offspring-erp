import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({ title, description, actions, crumbs }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; crumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 rtl:rotate-180" />}
                {c.href ? <Link href={c.href} className="hover:text-foreground">{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children ?? "—"}</dd>
    </div>
  );
}
