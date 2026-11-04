"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";

export const PALETTE = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))"];

const compact = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const kgf = (v: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)} kg`;
type Fmt = "usd" | "kg" | "pct" | "num";
const fmt = (f: Fmt) => (v: number) => (f === "usd" ? usd(v) : f === "kg" ? kgf(v) : f === "pct" ? `${v.toFixed(1)}%` : compact(v));

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format: Fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ms-auto font-medium tabular">{fmt(format)(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11, tickLine: false, axisLine: false } as const;

export function TrendChart({ data, series, format = "usd", height = 260, x = "month", stacked }: { data: Record<string, unknown>[]; series: { key: string; name: string; type?: "area" | "bar" | "line" }[]; format?: Fmt; height?: number; x?: string; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={x} {...axis} />
        <YAxis {...axis} tickFormatter={compact} width={48} />
        <Tooltip content={<TooltipBox format={format} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) =>
          s.type === "bar" ? (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} maxBarSize={28} stackId={stacked ? "a" : undefined} />
          ) : s.type === "line" ? (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} type="monotone" />
          ) : (
            <Area key={s.key} dataKey={s.key} name={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} fill={`url(#g-${s.key})`} type="monotone" />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({ data, format = "usd", height = 260, dataKey = "value", nameKey = "name" }: { data: Record<string, unknown>[]; format?: Fmt; height?: number; dataKey?: string; nameKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...axis} tickFormatter={compact} />
        <YAxis type="category" dataKey={nameKey} {...axis} width={120} />
        <Tooltip content={<TooltipBox format={format} />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey={dataKey} name="Value" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, format = "usd", height = 240 }: { data: { name: string; value: number }[]; format?: Fmt; height?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip content={<TooltipBox format={format} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-sm font-semibold tabular">{fmt(format)(total)}</div>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-xs sm:w-1/2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="truncate">{d.name}</span>
            <span className="ms-auto tabular text-muted-foreground">{total ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SimpleLine({ data, keys, height = 200, format = "num", x = "x" }: { data: Record<string, unknown>[]; keys: { key: string; name: string }[]; height?: number; format?: Fmt; x?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={x} {...axis} />
        <YAxis {...axis} tickFormatter={compact} width={52} />
        <Tooltip content={<TooltipBox format={format} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => <Line key={k.key} dataKey={k.key} name={k.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} type="monotone" />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MiniArea({ data, dataKey }: { data: Record<string, unknown>[]; dataKey: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data}><Area dataKey={dataKey} stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.15} strokeWidth={1.5} type="monotone" /></AreaChart>
    </ResponsiveContainer>
  );
}
