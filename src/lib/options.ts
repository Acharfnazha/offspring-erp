import "server-only";
import { prisma } from "@/lib/db";

export async function varietyOptions() {
  const vs = await prisma.productVariety.findMany({ where: { active: true }, include: { product: true }, orderBy: [{ product: { name: "asc" } }, { name: "asc" }] });
  return vs.map((v) => ({ value: v.id, label: `${v.product.name} — ${v.name}` }));
}
export async function roomOptions() {
  const rs = await prisma.coldRoom.findMany({ orderBy: { code: "asc" } });
  return rs.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}${r.status !== "OPERATIONAL" ? ` (${r.status.toLowerCase()})` : ""}` }));
}
export async function supplierOptions() {
  const s = await prisma.supplier.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });
  return s.map((x) => ({ value: x.id, label: x.name }));
}
export async function customerOptions() {
  const c = await prisma.customer.findMany({ where: { archivedAt: null }, orderBy: { companyName: "asc" } });
  return c.map((x) => ({ value: x.id, label: `${x.companyName} (${x.country})` }));
}
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return (s?.value as T) ?? fallback;
}
