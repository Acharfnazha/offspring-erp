import type { AssistantContext } from "./context";

/** Offline answer composer used when no AI provider is configured. Deterministic and grounded in the gathered data. */
export function demoAnswer(question: string, ctx: AssistantContext, companyName: string): string {
  const parts: string[] = [];
  const { intents, sections, params } = ctx;
  for (const s of sections) {
    parts.push(`**${s.title}**\n${s.lines.map((l) => `- ${l}`).join("\n")}`);
  }
  const product = params.variety ? String(params.variety) : "fresh Lebanese fruit";
  const kg = params.kg ? Number(params.kg).toLocaleString("en-US") : "[quantity]";
  const price = params.price ? `USD ${Number(params.price).toFixed(2)}/kg` : "USD [price]/kg";
  const city = params.city ? String(params.city) : "[destination]";
  const buyer = sections.find((s) => s.title.startsWith("Customers"))?.lines[0]?.split(" (")[0] ?? "[Buyer company]";

  if (intents.includes("draft_email")) {
    parts.push(`**Draft email** (review before sending)\n\n\`\`\`\nSubject: ${product} from Lebanon — offer for ${city}\n\nDear ${buyer} team,\n\nThank you for your interest in ${companyName}. We are pleased to offer ${kg} kg of ${product}, Class I / Extra grade, packed in export cartons with cold-chain handling from our refrigerated facilities in Lebanon.\n\nPrice: ${price}, FOB Beirut (freight and insurance not included unless agreed).\nShipment: reefer container, within 10–14 days of order confirmation.\nPayment: as per agreed terms.\n\nWe would be glad to share photos, quality reports and a formal quotation.\n\nBest regards,\n${companyName}\n\`\`\``);
  }
  if (intents.includes("draft_whatsapp")) {
    parts.push(`**Draft WhatsApp message** (review before sending)\n\n\`\`\`\nHello ${buyer} 👋 This is ${companyName}. We have ${kg} kg of ${product} ready for export to ${city}. Offer: ${price} FOB Beirut, reefer container within ~2 weeks. Shall I send the formal quotation and photos?\n\`\`\``);
  }
  if (intents.includes("draft_quote")) {
    parts.push(`**Draft quotation text** (create the formal PDF quotation via the link below)\n\n\`\`\`\nQUOTATION — ${companyName}\nBuyer: ${buyer}, ${city}\nProduct: ${product}, origin Lebanon, grade Extra / Class I\nPackaging: export cartons (5 kg grapes / 18 kg apples), palletized\nQuantity: ${kg} kg\nPrice: ${price}\nIncoterm: CFR ${city === "[destination]" ? "[port]" : city} (ocean freight included; insurance NOT included)\nPayment: 30% advance, 70% against copy of B/L\nShipment: 1 × 40' reefer, within 14 days of confirmation\nValidity: 14 days, subject to availability\n\`\`\``);
  }
  if (intents.includes("help")) {
    parts.push("I can answer from your live ERP data. Try:\n- How much profit did we make this month?\n- Which customers have unpaid invoices?\n- How many kilograms of Red Globe grapes are available?\n- Calculate my profit if I export 20,000 kg of apples at $1.10 per kg\n- Write a professional quotation for a buyer in Dubai\n- Summarize shipment status\n- Suggest inventory actions\n- Compare best and worst case scenarios");
  }
  if (sections.some((s) => s.restricted)) parts.push("_Some information was withheld because your role does not include access to it._");
  parts.push("_Offline demo mode: answers are generated from your database with fixed rules. Configure an AI provider in `.env` for free-form answers._");
  void question;
  return parts.join("\n\n");
}
