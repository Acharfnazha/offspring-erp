import { prisma } from "@/lib/db";
import { customerOptions, varietyOptions } from "@/lib/options";

export async function quotationFormData() {
  const [customers, varieties, rows] = await Promise.all([customerOptions(), varietyOptions(), prisma.productVariety.findMany({ include: { product: true } })]);
  const fill = Object.fromEntries(rows.map((v) => [v.id, { description: `${v.product.name} — ${v.name}`, packaging: v.product.category === "GRAPE" ? "5 kg carton" : "18 kg carton" }]));
  return { customers, varieties, fill };
}
