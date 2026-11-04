export type SP = Record<string, string | string[] | undefined>;

export function str(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length ? s : undefined;
}

export function listParams(sp: SP, allowedSort: string[], defaultSort: string, defaultDir: "asc" | "desc" = "desc") {
  const page = Math.max(1, Number(str(sp, "page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(str(sp, "pageSize") ?? 20) || 20));
  const sortRaw = str(sp, "sort");
  const sort = sortRaw && allowedSort.includes(sortRaw) ? sortRaw : defaultSort;
  const dir: "asc" | "desc" = str(sp, "dir") === "asc" ? "asc" : str(sp, "dir") === "desc" ? "desc" : defaultDir;
  const q = str(sp, "q")?.slice(0, 100);
  return { page, pageSize, sort, dir, q, skip: (page - 1) * pageSize, take: pageSize };
}

/** Build a Prisma orderBy from a dotted sort key, e.g. "customer.companyName". */
export function orderBy(sort: string, dir: "asc" | "desc"): Record<string, unknown> {
  const parts = sort.split(".");
  return parts.reduceRight<Record<string, unknown>>((acc, p, i) => (i === parts.length - 1 ? { [p]: dir } : { [p]: acc }), {} as Record<string, unknown>) as Record<string, unknown>;
}
