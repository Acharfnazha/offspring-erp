"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, UserPlus, Pencil, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ActionDialog } from "@/components/forms/action-dialog";
import { EntityForm } from "@/components/forms/entity-form";
import { createUserAction, resetLinkAction, setActiveAction, updateUserAction } from "./actions";
import { ActionButton } from "@/components/forms/action-button";

function LinkBox({ link }: { link: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Share this one-time link with the employee through a secure channel. It expires in 1 hour and can be used once.</p>
      <div className="flex gap-2"><Input readOnly value={link} aria-label="Reset link" /><Button size="icon" variant="outline" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Link copied"); }}><Copy /></Button></div>
    </div>
  );
}

export function NewEmployee({ roles }: { roles: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLink(null); }}>
      <DialogTrigger asChild><Button><UserPlus />New employee</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New employee account</DialogTitle><DialogDescription>Least privilege: pick the narrowest role that fits the job.</DialogDescription></DialogHeader>
        {link ? <LinkBox link={link} /> : (
          <EntityForm schema="user" cols={1} defaultValues={{ name: "", email: "", role: "EMPLOYEE", jobTitle: "", phone: "" }}
            action={async (v) => { const r = await createUserAction(v); if (r.ok) setLink((r.data as { link: string }).link); return r; }}
            onDone={() => undefined}
            fields={[{ name: "name", label: "Full name" }, { name: "email", label: "Work email", type: "email" }, { name: "role", label: "Role", type: "select", options: roles }, { name: "jobTitle", label: "Job title" }, { name: "phone", label: "Phone", type: "tel" }]} />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeRowActions({ id, name, role, jobTitle, active, roles, self }: { id: string; name: string; role: string; jobTitle: string; active: boolean; roles: { value: string; label: string }[]; self: boolean }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  return (
    <div className="flex justify-end gap-1">
      <ActionDialog trigger={<Button size="sm" variant="ghost"><Pencil />Edit</Button>} title={`Edit ${name}`} description="Changing a role signs the user out of all sessions." fields={[{ name: "name", label: "Name", defaultValue: name, required: true }, { name: "role", label: "Role", type: "select", options: roles, defaultValue: role }, { name: "jobTitle", label: "Job title", defaultValue: jobTitle }]} onSubmit={(v) => updateUserAction(id, v)} />
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent><DialogHeader><DialogTitle>Password reset link</DialogTitle></DialogHeader>{link && <LinkBox link={link} />}</DialogContent>
      </Dialog>
      <Button size="sm" variant="ghost" onClick={async () => { const r = await resetLinkAction(id); if (!r.ok) return toast.error(r.error); setLink((r.data as { link: string }).link); }}><KeyRound />Reset link</Button>
      {!self && <ActionButton variant="ghost" destructive={active} action={setActiveAction.bind(null, id, !active)} confirmTitle={active ? `Deactivate ${name}?` : `Reactivate ${name}?`} confirmText={active ? "The user is signed out immediately and cannot log in. History is retained." : undefined} >{active ? "Deactivate" : "Reactivate"}</ActionButton>}
    </div>
  );
}
