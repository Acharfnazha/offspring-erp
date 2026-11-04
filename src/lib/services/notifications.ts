import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import { addDays, isoDate, todayDate } from "@/lib/dates";
import { refreshOverdue } from "./finance";

let lastRun = 0;

/** Generates operational alerts (idempotent via dedupeKey). Throttled to once per minute per process. */
export async function generateAlerts(force = false) {
  if (!force && Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  await refreshOverdue(prisma);
  const today = todayDate();

  const overdue = await prisma.invoice.findMany({ where: { status: "OVERDUE" }, include: { customer: true, supplier: true }, take: 50 });
  for (const inv of overdue) {
    const balance = D(inv.total).minus(D(inv.amountPaid));
    await upsertAlert({
      dedupeKey: `overdue:${inv.id}`,
      type: "invoice.overdue",
      severity: "critical",
      audienceRole: "ACCOUNTANT",
      title: `Overdue invoice ${inv.invoiceNo}`,
      body: `${inv.customer?.companyName ?? inv.supplier?.name ?? ""} — balance ${balance.toFixed(2)} ${inv.currency}, due ${isoDate(inv.dueDate)}`,
      link: `/invoices/${inv.id}`,
    });
  }

  const expiring = await prisma.inventoryBatch.findMany({
    where: { status: { in: ["AVAILABLE", "RESERVED"] }, expiryDate: { lte: addDays(today, 7) } },
    include: { variety: true },
    take: 50,
  });
  for (const b of expiring) {
    await upsertAlert({
      dedupeKey: `expiry:${b.id}:${isoDate(b.expiryDate)}`,
      type: "inventory.expiring",
      severity: b.expiryDate! < today ? "critical" : "warning",
      audienceRole: "WAREHOUSE_MANAGER",
      title: `${b.expiryDate! < today ? "Expired" : "Expiring"} stock: ${b.batchNo}`,
      body: `${b.variety.name} — ${D(b.onHandKg).toFixed(0)} kg, best before ${isoDate(b.expiryDate)}`,
      link: `/inventory/${b.id}`,
    });
  }

  const rooms = await prisma.coldRoom.findMany({ where: { status: "OPERATIONAL" } });
  for (const r of rooms) {
    if (r.currentTempC === null || !r.lastReadingAt) continue;
    const dev = D(r.currentTempC).minus(D(r.targetTempC)).abs();
    if (dev.gt(D(r.tempToleranceC))) {
      await upsertAlert({
        dedupeKey: `temp:${r.id}:${r.lastReadingAt.toISOString()}`,
        type: "coldroom.temperature",
        severity: "critical",
        audienceRole: "WAREHOUSE_MANAGER",
        title: `Temperature exception in ${r.name}`,
        body: `Recorded ${D(r.currentTempC).toFixed(1)}°C vs target ${D(r.targetTempC).toFixed(1)}°C (±${D(r.tempToleranceC).toFixed(1)})`,
        link: `/cold-storage/rooms/${r.id}`,
      });
    }
  }

  const followUps = await prisma.customer.findMany({ where: { archivedAt: null, nextFollowUpAt: { lte: addDays(today, 1) } }, take: 50 });
  for (const c of followUps) {
    await upsertAlert({
      dedupeKey: `followup:${c.id}:${c.nextFollowUpAt!.toISOString().slice(0, 10)}`,
      type: "crm.followup",
      severity: "info",
      audienceRole: "SALES_MANAGER",
      title: `Follow up with ${c.companyName}`,
      body: `Scheduled ${isoDate(c.nextFollowUpAt)} · stage ${c.pipelineStage.replaceAll("_", " ").toLowerCase()}`,
      link: `/customers/${c.id}`,
    });
  }
}

async function upsertAlert(a: { dedupeKey: string; type: string; severity: string; audienceRole: Role | null; title: string; body: string; link: string }) {
  await prisma.notification.upsert({ where: { dedupeKey: a.dedupeKey }, create: a, update: {} });
}

const MANAGEMENT: Role[] = ["SUPER_ADMIN", "ADMIN"];

export async function unreadNotifications(user: { id: string; role: Role }, take = 20) {
  const roleFilter = MANAGEMENT.includes(user.role) ? {} : { OR: [{ audienceRole: null }, { audienceRole: user.role }] };
  const [direct, broadcast, markers] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id, readAt: null, NOT: { type: "read-marker" } }, orderBy: { createdAt: "desc" }, take }),
    prisma.notification.findMany({ where: { userId: null, ...roleFilter }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.findMany({ where: { userId: user.id, type: "read-marker" }, select: { dedupeKey: true } }),
  ]);
  const read = new Set(markers.map((m) => m.dedupeKey));
  const b = broadcast.filter((n) => !read.has(`${n.dedupeKey ?? n.id}:read:${user.id}`));
  return [...direct, ...b].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()).slice(0, take);
}
