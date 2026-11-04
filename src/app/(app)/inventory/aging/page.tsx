import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { D, formatKg } from "@/lib/money";
import { diffDays, formatDate, todayDate } from "@/lib/dates";
import { getSetting } from "@/lib/options";
import { label } from "@/lib/schemas";

export const metadata = { title: "FIFO / FEFO" };

export default async function AgingPage() {
  await requireUser("inventory:read");
  const strategy = (await getSetting<{ allocationStrategy: string }>("inventory", { allocationStrategy: "FEFO" })).allocationStrategy;
  const today = todayDate();
  const batches = await prisma.inventoryBatch.findMany({ where: { onHandKg: { gt: 0 } }, include: { variety: true, coldRoom: true }, orderBy: [{ variety: { name: "asc" } }, { arrivalDate: "asc" }] });
  const groups = new Map<string, typeof batches>();
  for (const b of batches) groups.set(b.variety.name, [...(groups.get(b.variety.name) ?? []), b]);
  return (
    <div className="space-y-4">
      <PageHeader title="FIFO aging & FEFO suggestions" crumbs={[{ label: "Inventory", href: "/inventory" }, { label: "FIFO / FEFO" }]} description={<>Batches in arrival order (FIFO). The suggested pick order follows <b>{strategy}</b> (configurable in Settings): earliest best-before first when expiry dates exist, then oldest arrival.</>} />
      {[...groups.entries()].map(([variety, list]) => {
        const fefo = [...list].filter((b) => b.status !== "QUARANTINE").sort((a, b) => (strategy === "FEFO" ? (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity) : 0) || a.arrivalDate.getTime() - b.arrivalDate.getTime());
        const rank = new Map(fefo.map((b, i) => [b.id, i + 1]));
        return (
          <Card key={variety}>
            <CardHeader><CardTitle>{variety}</CardTitle><CardDescription>{formatKg(list.reduce((a, b) => a.plus(b.onHandKg), D(0)))} on hand · {list.length} batches</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2 text-start">Batch</th><th className="px-4 py-2 text-start">Grade</th><th className="px-4 py-2 text-start">Room</th><th className="px-4 py-2 text-start">Arrived</th><th className="px-4 py-2 text-end">Age (days)</th><th className="px-4 py-2 text-start">Best before</th><th className="px-4 py-2 text-end">Available</th><th className="px-4 py-2 text-center">{strategy} pick #</th></tr></thead>
                <tbody>
                  {list.map((b) => {
                    const days = b.expiryDate ? diffDays(today, b.expiryDate) : null;
                    return (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-xs"><Link className="text-primary hover:underline" href={`/inventory/${b.id}`}>{b.batchNo}</Link></td>
                        <td className="px-4 py-2">{label(b.grade)}</td>
                        <td className="px-4 py-2">{b.coldRoom?.code ?? "—"}</td>
                        <td className="px-4 py-2">{formatDate(b.arrivalDate)}</td>
                        <td className="px-4 py-2 text-end tabular">{diffDays(b.arrivalDate, today)}</td>
                        <td className="px-4 py-2">{formatDate(b.expiryDate)} {days !== null && days <= 7 && <Badge variant={days < 0 ? "danger" : "warning"}>{days < 0 ? "expired" : `${days}d left`}</Badge>}</td>
                        <td className="px-4 py-2 text-end tabular">{formatKg(D(b.onHandKg).minus(D(b.reservedKg)))}</td>
                        <td className="px-4 py-2 text-center">{rank.get(b.id) ? <Badge variant={rank.get(b.id) === 1 ? "success" : "muted"}>{rank.get(b.id)}</Badge> : <Badge variant="warning">hold</Badge>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
      {groups.size === 0 && <p className="text-sm text-muted-foreground">No stock on hand.</p>}
    </div>
  );
}
