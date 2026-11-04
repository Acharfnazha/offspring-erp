import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthError, BusinessError } from "./errors";
export { BusinessError };

export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };


/** Wraps a server action body, turning known failures into user-friendly results. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) fieldErrors[issue.path.join(".")] = issue.message;
      return { ok: false, error: e.issues[0]?.message ?? "Validation failed", fieldErrors };
    }
    if (e instanceof AuthError || e instanceof BusinessError) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { ok: false, error: "A record with the same unique value already exists (possible duplicate submission)." };
      if (e.code === "P2025") return { ok: false, error: "The record no longer exists." };
      if (e.code === "P2003") return { ok: false, error: "This record is referenced by other records and cannot be removed." };
    }
    console.error("[action]", e);
    if (e instanceof Error && /exceeds|cannot|must|Invalid/i.test(e.message)) return { ok: false, error: e.message };
    return { ok: false, error: "Unexpected error. The operation was not completed." };
  }
}
