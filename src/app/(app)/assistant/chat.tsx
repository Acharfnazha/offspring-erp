"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Sparkles, Copy, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { askAssistantAction } from "./actions";

interface Msg { role: "user" | "assistant"; content: string; actions?: { label: string; href: string }[] }

const EXAMPLES = [
  "How much profit did we make this month?",
  "Which customers have unpaid invoices?",
  "How many kilograms of Red Globe grapes are available?",
  "Calculate my profit if I export 20,000 kg of apples at $1.10 per kg.",
  "Write a professional quotation for a buyer in Dubai.",
  "Summarize shipment status",
  "Suggest inventory actions",
  "Compare best and worst case scenarios for 18,000 kg Crimson Seedless at $2.70",
];

function Rich({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        i % 2 === 1 ? (
          <div key={i} className="relative rounded-lg border bg-muted/50 p-3">
            <button className="absolute end-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted" title="Copy draft" onClick={() => { navigator.clipboard?.writeText(b.trim()); toast.success("Draft copied"); }}><Copy className="h-3.5 w-3.5" /></button>
            <pre className="whitespace-pre-wrap pe-6 font-sans text-[13px]">{b.trim()}</pre>
          </div>
        ) : (
          b.split(/\n/).map((line, j) => {
            const html = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/_(.+?)_/g, "<i class='text-muted-foreground'>$1</i>").replace(/`(.+?)`/g, "<code>$1</code>");
            if (!line.trim()) return null;
            return line.trim().startsWith("- ") ? <div key={`${i}-${j}`} className="flex gap-2 ps-1"><span className="text-emerald-600">•</span><span dangerouslySetInnerHTML={{ __html: html.trim().slice(2) }} /></div> : <p key={`${i}-${j}`} dangerouslySetInnerHTML={{ __html: html }} />;
          })
        ),
      )}
    </div>
  );
}

export function AssistantChat({ mode }: { mode: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = msgs.map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setQ("");
    setBusy(true);
    const r = await askAssistantAction({ question, history });
    setBusy(false);
    if (!r.ok) { toast.error(r.error); setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${r.error}` }]); return; }
    const d = r.data as { answer: string; actions: { label: string; href: string }[] };
    setMsgs((m) => [...m, { role: "assistant", content: d.answer, actions: d.actions }]);
  };
  return (
    <Card className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {msgs.length === 0 && (
          <div className="mx-auto max-w-2xl py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-white"><Sparkles /></div>
            <h2 className="mt-3 text-lg font-semibold">Ask about your business</h2>
            <p className="text-sm text-muted-foreground">Answers use live ERP data you are authorized to see. The assistant is read-only — it never changes records.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((e) => <button key={e} onClick={() => ask(e)} className="rounded-lg border bg-card px-3 py-2 text-start text-sm transition hover:border-primary hover:bg-accent">{e}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-muted" : "bg-emerald-600 text-white")}>{m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}</div>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card")} data-testid={m.role === "assistant" ? "assistant-message" : undefined}>
              {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Rich text={m.content} />}
              {m.actions && m.actions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{m.actions.map((a) => <Button key={a.href} size="sm" variant="outline" asChild><Link href={a.href}>{a.label} →</Link></Button>)}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyzing your data…</div>}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…" aria-label="Question" maxLength={2000} className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" />
        <Button disabled={busy || !q.trim()} className="h-10"><Send />Ask</Button>
      </form>
      <div className="border-t bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground">Mode: {mode === "demo" ? "offline demo (no external AI calls)" : `${mode} — questions and the relevant aggregated figures are sent to the configured provider`}</div>
    </Card>
  );
}
