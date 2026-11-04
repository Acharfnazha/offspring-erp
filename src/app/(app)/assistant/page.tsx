import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { getProvider } from "@/lib/ai/provider";
import { AssistantChat } from "./chat";

export const metadata = { title: "AI Assistant" };

export default async function AssistantPage() {
  await requireUser("ai:use");
  const p = getProvider();
  return (
    <div>
      <PageHeader title="AI business assistant" description="Sales, inventory, receivables, shipments, profit estimates and buyer drafts — grounded in your ERP data and limited to your permissions." />
      <AssistantChat mode={p?.name ?? "demo"} />
    </div>
  );
}
