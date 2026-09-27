import type { AiMessage } from "@/types";

/**
 * Shared LLM completion helper. Provider chain (first one that succeeds
 * wins): Groq -> Gemini -> Pollinations -> canned fallback. Used by both the
 * persistent Assistant chat (api/ai/chat) and the stateless embedded
 * suggestions (api/ai/suggest) - see orbit-overhaul.md's push to make AI a
 * suggestion layer across Home/Clients/Money, not just a standalone chat.
 */

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_POLLINATIONS_MODEL = "openai";

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface CompleteChatResult {
  reply: string;
  provider: "groq" | "gemini" | "pollinations" | "demo";
  simulated?: boolean;
  providerErrors?: string[];
}

async function callGroq(messages: AiMessage[], systemPrompt: string, apiKey: string): Promise<string> {
  const model = process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `Groq ${res.status}`);
  return json.choices?.[0]?.message?.content?.trim()
    ?? "Sorry, I didn't catch that.";
}

async function callGemini(messages: AiMessage[], systemPrompt: string, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 600, topP: 0.95 },
    }),
  });
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `Gemini ${res.status}`);
  if (json.promptFeedback?.blockReason) {
    return "I can't help with that one - mind asking something else?";
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim() || "Sorry, I didn't catch that.";
}

/**
 * Pollinations.ai - free, no API key required. Used as the default so AI
 * features work for everyone out of the box.
 */
async function callPollinations(messages: AiMessage[], systemPrompt: string): Promise<string> {
  const model = process.env.POLLINATIONS_MODEL ?? DEFAULT_POLLINATIONS_MODEL;
  const res = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      model,
      private: true,
      seed: Math.floor(Math.random() * 1_000_000),
    }),
  });
  if (!res.ok) {
    throw new Error(`Pollinations ${res.status}`);
  }
  const text = (await res.text()).trim();
  return text || "Sorry, I didn't catch that.";
}

/** Last-resort canned reply if every upstream provider failed. */
function cannedReply(userMsg: string): string {
  const m = userMsg.toLowerCase();
  if (m.includes("follow") || m.includes("reminder")) {
    return "Here's a soft follow-up you could send:\n\n\"Hi [Name]! Just checking in - your invoice from [date] is still on my radar. No pressure, but if you can settle this week that would help me close the books.\"\n\nWant me to draft a more direct version too?";
  }
  if (m.includes("price") || m.includes("charge") || m.includes("rate")) {
    return "Pricing is a confidence game more than a numbers game.\n\n1. What's the cheapest competitor charging?\n2. What's the most expensive?\n3. Where do you want to sit on that spectrum?\n\nIt usually pays to be in the top third. Cheap pricing attracts cheap customers.";
  }
  if (m.includes("grow") || m.includes("more clients") || m.includes("marketing")) {
    return "The fastest growth lever for service businesses is referrals.\n\nAfter every happy client, send: \"Thank you for being such a dream to work with. If you ever know someone who'd love [your service], I'd love to meet them - I'll knock 10% off their first session as a thank-you.\"\n\nRun it consistently for 30 days.";
  }
  return "I'm having trouble reaching my AI right now. Try again in a moment, or try a different question.\n\nThings I'm great at: payment follow-ups, pricing, getting more clients.";
}

export async function completeChat(messages: AiMessage[], systemPrompt: string): Promise<CompleteChatResult> {
  const providers: Array<{ name: "groq" | "gemini" | "pollinations"; run: () => Promise<string> }> = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "groq", run: () => callGroq(messages, systemPrompt, process.env.GROQ_API_KEY!) });
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push({ name: "gemini", run: () => callGemini(messages, systemPrompt, process.env.GEMINI_API_KEY!) });
  }
  providers.push({ name: "pollinations", run: () => callPollinations(messages, systemPrompt) });

  const errors: string[] = [];
  for (const p of providers) {
    try {
      const reply = await p.run();
      return { reply, provider: p.name };
    } catch (err) {
      errors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
      console.warn(`[ai] ${p.name} failed:`, err);
    }
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  return { reply: cannedReply(lastUserMsg), provider: "demo", simulated: true, providerErrors: errors };
}
