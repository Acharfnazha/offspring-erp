import type { Tx } from "./db";

/** Atomically allocate the next document number, e.g. INV-2026-00042. Safe under concurrency. */
export async function nextNumber(tx: Tx, prefix: string, opts: { year?: boolean; pad?: number } = {}): Promise<string> {
  const year = opts.year === false ? "" : String(new Date().getUTCFullYear());
  const key = year ? `${prefix}-${year}` : prefix;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  const n = rows[0].value;
  return `${key}-${String(n).padStart(opts.pad ?? 5, "0")}`;
}
