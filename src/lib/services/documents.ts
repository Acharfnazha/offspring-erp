import "server-only";
import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Document, DocumentAccess } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
export const MAX_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024;

export const ALLOWED: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

const MAGIC: [string, number[]][] = [
  ["application/pdf", [0x25, 0x50, 0x44, 0x46]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [0x50, 0x4b, 0x03, 0x04]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [0x50, 0x4b, 0x03, 0x04]],
];

/** Validates declared type + extension + file signature. Returns the safe mime type or throws. */
export function validateFile(name: string, declared: string, buf: Buffer): string {
  if (buf.length === 0) throw new Error("File is empty");
  if (buf.length > MAX_BYTES) throw new Error(`File exceeds the ${MAX_BYTES / 1024 / 1024} MB limit`);
  const ext = path.extname(name).toLowerCase();
  const mime = Object.entries(ALLOWED).find(([m, exts]) => exts.includes(ext) && (m === declared || declared === "" || declared === "application/octet-stream"))?.[0]
    ?? Object.entries(ALLOWED).find(([, exts]) => exts.includes(ext))?.[0];
  if (!mime) throw new Error(`File type ${ext || declared} is not allowed`);
  const sig = MAGIC.find(([m]) => m === mime);
  if (sig && !sig[1].every((b, i) => buf[i] === b)) throw new Error("File content does not match its extension");
  if (mime === "image/webp" && buf.subarray(8, 12).toString("ascii") !== "WEBP") throw new Error("File content does not match its extension");
  return mime;
}

export async function storeFile(buf: Buffer) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const key = `${new Date().toISOString().slice(0, 7)}-${randomBytes(16).toString("hex")}`;
  await writeFile(path.join(UPLOAD_DIR, key), buf, { mode: 0o600 });
  return { key, sha256: createHash("sha256").update(buf).digest("hex") };
}

export async function readStoredFile(key: string) {
  if (!/^[\w-]+$/.test(key)) throw new Error("Invalid storage key");
  return readFile(path.join(UPLOAD_DIR, key));
}

export function canAccessAccess(user: SessionUser, access: DocumentAccess): boolean {
  if (!hasPermission(user.role, "documents:read")) return false;
  if (access === "FINANCE") return hasPermission(user.role, "documents:finance");
  if (access === "MANAGEMENT") return hasPermission(user.role, "documents:management");
  return true;
}

export function canAccessDocument(user: SessionUser, doc: Pick<Document, "access" | "invoiceId" | "expenseId">): boolean {
  if (!canAccessAccess(user, doc.access)) return false;
  if ((doc.invoiceId || doc.expenseId) && !hasPermission(user.role, "finance:read") && !hasPermission(user.role, "expenses:read")) return false;
  return true;
}

export function accessFilter(user: SessionUser): DocumentAccess[] {
  return (["ALL_STAFF", "FINANCE", "MANAGEMENT"] as DocumentAccess[]).filter((a) => canAccessAccess(user, a));
}
