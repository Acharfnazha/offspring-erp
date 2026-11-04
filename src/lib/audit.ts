import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
}

function json(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val)));
}

export async function audit(entry: AuditEntry, tx: Tx = prisma) {
  await tx.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: json(entry.before),
      after: json(entry.after),
    },
  });
}
