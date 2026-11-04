"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">The page could not be loaded. No data was changed. {error.digest && <span className="font-mono text-xs">Ref: {error.digest}</span>}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
