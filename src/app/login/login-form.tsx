"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/server/auth-actions";

export function LoginForm({ next, labels }: { next?: string; labels: { signIn: string; email: string; password: string; forgot: string; welcome: string } }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="w-full max-w-sm space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{labels.welcome}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to OFFSPRING ERP</p>
      </div>
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-1.5">
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{labels.password}</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">{labels.forgot}</Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{labels.signIn}</Button>
      <p className="text-center text-xs text-muted-foreground">Demo: admin@offspring.example / Offspring!2026</p>
    </form>
  );
}
