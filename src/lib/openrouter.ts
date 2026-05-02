import OpenAI from "openai";
import { getBusinessProfile } from "./db";
import { SYSTEM_PROMPT } from "./system-prompt";
import type { Message } from "./db";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

async function buildSystemPrompt(): Promise<string> {
  const profile = await getBusinessProfile().catch(() => null);
  if (!profile) return SYSTEM_PROMPT;

  if (
    !profile.name &&
    !profile.description &&
    profile.products.length === 0 &&
    !profile.extra
  ) {
    return SYSTEM_PROMPT;
  }

  const lines: string[] = [];

  if (profile.name) {
    lines.push(`Sos el asistente virtual de ${profile.name}.`);
  } else {
    lines.push("Sos un asistente virtual de un negocio.");
  }

  if (profile.description) {
    lines.push("", profile.description);
  }

  if (profile.products.length > 0) {
    lines.push("", "CATÁLOGO DE PRODUCTOS / SERVICIOS:");
    for (const p of profile.products) {
      let item = `• ${p.name}`;
      if (p.price) item += ` — ${p.price}`;
      if (p.description) item += `: ${p.description}`;
      lines.push(item);
    }
  }

  if (profile.extra) {
    lines.push("", "INFORMACIÓN ADICIONAL:", profile.extra);
  }

  lines.push(
    "",
    "Cuando un cliente pregunte qué ofrecés, quiera comprar, cotizar o reservar, usá la información anterior para responder con precisión.",
    "Respondé en español neutro, en mensajes breves de 2 a 4 líneas. No uses emojis.",
    'Si el cliente pide algo que no podés resolver, respondé: "Déjame derivarte con un asesor."'
  );

  return lines.join("\n");
}

export async function generateReply(history: Message[]): Promise<string> {
  const systemPrompt = await buildSystemPrompt();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 300,
    temperature: 0.7,
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "No pude generar una respuesta."
  );
}
