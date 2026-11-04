"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { DOC_CATEGORIES } from "@/lib/schemas";
import { storeFile, validateFile } from "@/lib/services/documents";
import { hasPermission } from "@/lib/auth/permissions";
import { BusinessError } from "@/lib/errors";

const meta = z.object({
  category: z.enum(DOC_CATEGORIES),
  access: z.enum(["ALL_STAFF", "FINANCE", "MANAGEMENT"]),
  description: z.string().max(500).optional(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  shipmentId: z.string().optional(),
  invoiceId: z.string().optional(),
  expenseId: z.string().optional(),
  batchId: z.string().optional(),
});

export async function uploadDocumentAction(form: FormData) {
  return runAction(async () => {
    const user = await assertPermission("documents:write");
    const file = form.get("file");
    if (!(file instanceof File)) throw new BusinessError("Choose a file to upload");
    const m = meta.parse(Object.fromEntries([...form.entries()].filter(([k, v]) => k !== "file" && v !== "")));
    if (m.access === "FINANCE" && !hasPermission(user.role, "documents:finance")) throw new BusinessError("You cannot upload finance-restricted documents");
    if (m.access === "MANAGEMENT" && !hasPermission(user.role, "documents:management")) throw new BusinessError("You cannot upload management-restricted documents");
    const buf = Buffer.from(await file.arrayBuffer());
    let mime: string;
    try { mime = validateFile(file.name, file.type, buf); } catch (e) { throw new BusinessError((e as Error).message); }
    const { key, sha256 } = await storeFile(buf);
    const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 150);
    const doc = await prisma.document.create({
      data: { name: safeName, category: m.category, mimeType: mime, sizeBytes: buf.length, storageKey: key, sha256, access: m.access, description: m.description, customerId: m.customerId, supplierId: m.supplierId, shipmentId: m.shipmentId, invoiceId: m.invoiceId, expenseId: m.expenseId, batchId: m.batchId, uploadedById: user.id },
    });
    await audit({ userId: user.id, action: "document.upload", entity: "Document", entityId: doc.id, summary: `Uploaded ${safeName}` });
    revalidatePath("/", "layout");
    return { id: doc.id };
  }, "Document uploaded");
}

export async function archiveDocumentAction(id: string) {
  return runAction(async () => {
    const user = await assertPermission("documents:write");
    const doc = await prisma.document.update({ where: { id }, data: { archivedAt: new Date() } });
    await audit({ userId: user.id, action: "document.archive", entity: "Document", entityId: id, summary: `Archived ${doc.name}` });
    revalidatePath("/", "layout");
  }, "Document archived");
}
