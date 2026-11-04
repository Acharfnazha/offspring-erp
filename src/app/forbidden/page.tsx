import Link from "next/link";
import { ShieldAlert } from "lucide-react";
export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldAlert className="h-10 w-10 text-amber-500" />
      <h1 className="text-xl font-semibold">Access restricted</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Your role does not include permission to view this page. Contact an administrator if you need access.</p>
      <Link href="/dashboard" className="text-sm text-primary hover:underline">Return to overview</Link>
    </div>
  );
}
