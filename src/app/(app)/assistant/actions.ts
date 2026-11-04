"use server";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/session";
import { runAction } from "@/lib/action";
import { BusinessError } from "@/lib/errors";
import { gatherContext } from "@/lib/ai/context";
import { demoAnswer } from "@/lib/ai/demo";
import { getProvider } from "@/lib/ai/provider";
import { getSetting } from "@/lib/options";
import { audit } from "@/lib/audit";

const buckets = new Map<string, number[]>();
function rateLimit(userId: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const arr = (buckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new BusinessError("Too many questions in a short time — please wait a minute.");
  arr.push(now);
  buckets.set(userId, arr);
}

const input = z.object({ question: z.string().trim().min(2).max(2000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(20).default([]) });

export async function askAssistantAction(values: unknown) {
  return runAction(async () => {
    const user = await assertPermission("ai:use");
    rateLimit(user.id);
    const { question, history } = input.parse(values);
    const ctx = await gatherContext(user, question);
    const company = (await getSetting<{ name: string }>("company", { name: "Offspring Group S.A.R.L." })).name;
    const provider = getProvider();
    let answer: string;
    let mode = "demo";
    if (provider) {
      try {
        answer = await provider.answer(question, ctx, history, company);
        mode = provider.name;
      } catch (e) {
        console.error("[assistant] provider error", e instanceof Error ? e.message : e);
        answer = `${demoAnswer(question, ctx, company)}\n\n_The AI provider could not be reached; this answer was produced offline._`;
      }
    } else {
      answer = demoAnswer(question, ctx, company);
    }
    await audit({ userId: user.id, action: "assistant.ask", entity: "Assistant", summary: `[${mode}] intents: ${ctx.intents.join(", ")}` });
    return { answer, actions: ctx.actions, mode };
  });
}
