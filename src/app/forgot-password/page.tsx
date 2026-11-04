"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/server/auth-actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, undefined);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {state?.done ? (
          <p className="text-sm text-muted-foreground">If an active account exists for that email, a reset link has been issued. In this installation the link is delivered via the server log or by an administrator (Employees → Reset link).</p>
        ) : (
          <>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
            <Button className="w-full" disabled={pending}>Send reset link</Button>
          </>
        )}
        <Link href="/login" className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
      </form>
    </div>
  );
}
