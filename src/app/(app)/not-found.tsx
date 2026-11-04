import Link from "next/link";
export default function NotFound() {
  return <div className="flex flex-col items-center gap-2 py-24 text-center"><h1 className="text-xl font-semibold">Record not found</h1><p className="text-sm text-muted-foreground">It may have been removed or you followed an outdated link.</p><Link href="/dashboard" className="text-sm text-primary hover:underline">Back to overview</Link></div>;
}
