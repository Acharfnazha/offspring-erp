import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessDocument, readStoredFile } from "@/lib/services/documents";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.archivedAt) return new Response("Not found", { status: 404 });
  if (!canAccessDocument(user, doc)) return new Response("Forbidden", { status: 403 });
  const buf = await readStoredFile(doc.storageKey);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"].includes(doc.mimeType);
  await audit({ userId: user.id, action: "document.download", entity: "Document", entityId: doc.id });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.name)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
