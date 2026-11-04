import { FileText, Download, Eye } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth/session";
import { accessFilter } from "@/lib/services/documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { UploadDocument } from "./upload-document";
import { ActionButton } from "@/components/forms/action-button";
import { archiveDocumentAction } from "@/app/(app)/documents/actions";

export async function DocumentList({ owner, title = "Documents", defaultCategory }: { owner: Prisma.DocumentWhereInput & Record<string, string>; title?: string; defaultCategory?: string }) {
  const user = await getCurrentUser();
  if (!user || !can(user, "documents:read")) return null;
  const docs = await prisma.document.findMany({ where: { ...owner, archivedAt: null, access: { in: accessFilter(user) } }, orderBy: { createdAt: "desc" }, include: { uploadedBy: true } });
  const write = can(user, "documents:write");
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {write && <UploadDocument owner={owner as Record<string, string>} defaultCategory={defaultCategory} />}
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? <p className="text-xs text-muted-foreground">No documents attached.</p> : (
          <ul className="divide-y">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.category} · {(d.sizeBytes / 1024).toFixed(0)} KB · {formatDate(d.createdAt)} · {d.uploadedBy?.name}</div>
                </div>
                {["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"].includes(d.mimeType) && <a className="rounded p-1.5 hover:bg-muted" title="Preview" href={`/api/documents/${d.id}?inline=1`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>}
                <a className="rounded p-1.5 hover:bg-muted" title="Download" href={`/api/documents/${d.id}`}><Download className="h-4 w-4" /></a>
                {write && <ActionButton variant="ghost" action={archiveDocumentAction.bind(null, d.id)} confirmTitle="Archive document?" confirmText="It will no longer be listed. The file is retained for audit purposes.">Archive</ActionButton>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
