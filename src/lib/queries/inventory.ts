import type { Prisma } from "@prisma/client";
import { str, type SP } from "@/lib/list-params";

export function batchWhere(sp: SP): Prisma.InventoryBatchWhereInput {
  const q = str(sp, "q");
  const status = str(sp, "status");
  return {
    ...(q ? { OR: [{ batchNo: { contains: q, mode: "insensitive" } }, { variety: { name: { contains: q, mode: "insensitive" } } }, { origin: { contains: q, mode: "insensitive" } }, { supplier: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    ...(status === "in_stock" || !status ? { onHandKg: { gt: 0 } } : status === "all" ? {} : { status: status as never }),
    ...(str(sp, "variety") ? { varietyId: str(sp, "variety") } : {}),
    ...(str(sp, "room") ? { coldRoomId: str(sp, "room") } : {}),
    ...(str(sp, "grade") ? { grade: str(sp, "grade") as never } : {}),
  };
}

