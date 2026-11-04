"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/server/auth-actions";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      {state?.done ? (
        <p className="text-sm">Your password was updated. All sessions were signed out. <Link className="text-primary underline" href="/login">Sign in</Link></p>
      ) : (
        <>
          <input type="hidden" name="token" value={token} />
          <div className="space-y-1.5"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" required minLength={10} /></div>
          <div className="space-y-1.5"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" required /></div>
          <p className="text-xs text-muted-foreground">At least 10 characters with upper- and lowercase letters and a number.</p>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button className="w-full" disabled={pending}>Update password</Button>
        </>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return <div className="flex min-h-screen items-center justify-center p-6"><Suspense><ResetForm /></Suspense></div>;
}
