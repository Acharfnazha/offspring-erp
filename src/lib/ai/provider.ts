import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AssistantContext } from "./context";

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface AIProvider { name: string; external: boolean; answer(q: string, ctx: AssistantContext, history: ChatTurn[], company: string): Promise<string> }

const SYSTEM = (company: string) => `You are the business assistant inside OFFSPRING ERP, the operations system of ${company}, a Lebanese exporter of fresh fruit (apples, grapes, peaches, nectarines) that also runs refrigerated storage.
Answer using ONLY the business data provided in the <erp_data> block of the latest user message; if the data does not contain the answer, say so and point to the relevant ERP page. Never invent figures, prices, tracking positions or customers.
You cannot change any record. When the user wants something changed (a quotation, order, payment, stock movement), explain the steps and tell them to use the linked page — they must confirm the action themselves.
Monetary values are USD unless stated. Be concise, use short paragraphs or bullet lists, and label drafts (emails, WhatsApp messages, quotation text) clearly as drafts to review before sending. Respect any "permission" notes: do not speculate about withheld data.`;

let client: Anthropic | null = null;

export const anthropicProvider: AIProvider = {
  name: "anthropic",
  external: true,
  async answer(q, ctx, history, company) {
    client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 });
    const data = ctx.sections.map((s) => `## ${s.title}\n${s.lines.map((l) => `- ${l}`).join("\n")}`).join("\n\n") || "(no business data was needed for this question)";
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history.slice(-8).map((t) => ({ role: t.role, content: t.content.slice(0, 4000) })),
      { role: "user", content: `<erp_data>\n${data}\n</erp_data>\n\n${q}` },
    ];
    // Ensure the conversation starts with a user turn
    while (messages.length && messages[0].role !== "user") messages.shift();
    const response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: (process.env.ANTHROPIC_EFFORT as "low" | "medium" | "high") || "medium" },
      // Server-side refusal fallback: routes a declined request to a fallback model by refusal category.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM(company),
      messages,
    });
    if (response.stop_reason === "refusal") return "The AI provider declined to answer this request. Please rephrase, or use the linked ERP pages directly.";
    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    return text || "The AI provider returned an empty answer.";
  },
};

export function getProvider(): AIProvider | null {
  if (process.env.AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  return null;
}
