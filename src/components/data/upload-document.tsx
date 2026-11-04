"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOC_CATEGORIES } from "@/lib/schemas";
import { uploadDocumentAction } from "@/app/(app)/documents/actions";

export function UploadDocument({ owner, defaultCategory = "Other", owners }: { owner?: Record<string, string>; defaultCategory?: string; owners?: { name: string; label: string; options: { value: string; label: string }[] }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Upload />Upload</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload document</DialogTitle><DialogDescription>PDF, images, CSV, XLSX, DOCX, TXT · max 10 MB. Uploading does not certify a document as legally valid; trade documents require appropriate review.</DialogDescription></DialogHeader>
        <form
          ref={ref}
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const fd = new FormData(e.currentTarget);
            for (const [k, v] of Object.entries(owner ?? {})) fd.set(k, v);
            const res = await uploadDocumentAction(fd);
            setBusy(false);
            if (!res.ok) return toast.error(res.error);
            toast.success("Document uploaded");
            setOpen(false);
            router.refresh();
          }}
        >
          <div className="space-y-1.5"><Label htmlFor="file">File</Label><Input id="file" name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.xlsx,.docx" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="category">Category</Label><NativeSelect id="category" name="category" defaultValue={defaultCategory}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></div>
            <div className="space-y-1.5"><Label htmlFor="access">Access</Label><NativeSelect id="access" name="access" defaultValue="ALL_STAFF"><option value="ALL_STAFF">All staff</option><option value="FINANCE">Finance only</option><option value="MANAGEMENT">Management only</option></NativeSelect></div>
          </div>
          {owners?.map((o) => (
            <div key={o.name} className="space-y-1.5"><Label htmlFor={o.name}>{o.label}</Label><NativeSelect id={o.name} name={o.name}><option value="">— None —</option>{o.options.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</NativeSelect></div>
          ))}
          <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Input id="description" name="description" maxLength={500} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>{busy && <Loader2 className="animate-spin" />}Upload</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
