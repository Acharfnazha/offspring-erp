"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { label } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { setStageAction } from "../actions";

export interface Card { id: string; name: string; country: string; stage: string; followUp: string | null; overdue: boolean; openValue: string }

export function PipelineBoard({ stages, cards, canEdit }: { stages: readonly string[]; cards: Card[]; canEdit: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(cards);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const move = (id: string, stage: string) => {
    const prev = items;
    setItems(items.map((c) => (c.id === id ? { ...c, stage } : c)));
    start(async () => {
      const r = await setStageAction(id, stage);
      if (!r.ok) { toast.error(r.error); setItems(prev); } else { toast.success(`Moved to ${label(stage)}`); router.refresh(); }
    });
  };
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((s) => {
        const list = items.filter((c) => c.stage === s);
        return (
          <div
            key={s}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(s); } }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, s); }}
            className={cn("flex w-64 shrink-0 flex-col rounded-xl border bg-muted/40 p-2", over === s && "ring-2 ring-primary")}
          >
            <div className="flex items-center justify-between px-1.5 py-1 text-xs font-semibold"><span>{label(s)}</span><span className="rounded-full bg-card px-2 text-muted-foreground">{list.length}</span></div>
            <div className="mt-1 flex min-h-24 flex-col gap-2">
              {list.map((c) => (
                <div key={c.id} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)} className="cursor-grab rounded-lg border bg-card p-2.5 shadow-sm active:cursor-grabbing">
                  <Link href={`/customers/${c.id}`} className="block text-sm font-medium leading-snug hover:text-primary">{c.name}</Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">{c.country}</div>
                  {Number(c.openValue) > 0 && <div className="mt-1 text-xs tabular">Open: ${Number(c.openValue).toLocaleString()}</div>}
                  {c.followUp && <div className={cn("mt-1.5 flex items-center gap-1 text-[11px]", c.overdue ? "text-red-600" : "text-muted-foreground")}><CalendarClock className="h-3 w-3" />{c.followUp}</div>}
                  {canEdit && (
                    <select aria-label="Move stage" value={c.stage} onChange={(e) => move(c.id, e.target.value)} className="mt-2 w-full rounded border bg-background px-1 py-0.5 text-[11px] lg:hidden">
                      {stages.map((x) => <option key={x} value={x}>{label(x)}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
