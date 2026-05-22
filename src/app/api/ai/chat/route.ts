import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AiMessage } from "@/types";

/**
 * AI Assistant - persistent chat backed by a free LLM provider.
 *
 * Provider chain (first one that succeeds wins):
 *   1. Groq          (if GROQ_API_KEY set)          - 30 req/min free, very fast
 *   2. Gemini        (if GEMINI_API_KEY set)        - 15 req/min free (regional)
 *   3. Pollinations  (no key needed, ZERO config)    - free public endpoint
 *   4. Canned demo   (only if all upstream fail)    - keeps UI usable offline
 *
 * Result: the Assistant works out of the box. Users can add a Groq key later
 * for higher reliability + speed, but they don't have to.
 *
 * Get a Groq key (optional, recommended) at https://console.groq.com/keys
 */

const SYSTEM_PROMPT = `You are the Orbit AI Assistant - a warm, practical business coach for service-business owners (freelancers, nail techs, makeup artists, tutors, photographers, coaches, repair techs, event planners, home service providers). Many of your users run small businesses in Nigeria and across Africa - keep that context in mind.

Style:
- Speak like a friend who's also a business advisor - encouraging, never corporate.
- Keep answers concise (2-4 short paragraphs max).
- Use specific, actionable suggestions, not generic advice.
- Ask one clarifying question if needed, otherwise just help.

Topics you help with: client follow-ups, pricing, payment reminders, retention, scaling, marketing copy, booking flows, invoicing tone.

Never: discuss politics, give legal/medical advice, or recommend specific paid tools beyond Orbit's built-in features.`;

const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_POLLINATIONS_MODEL = "openai";

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

function isMissingTableError(err: { code?: string; message?: string }): boolean {
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

function deriveTitle(messages: AiMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const cleaned = firstUser.content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 40) return cleaned || "New chat";
  return `${cleaned.slice(0, 38).trim()}...`;
}

// ─── Provider calls ────────────────────────────────────────────────────────

async function callGroq(messages: AiMessage[], apiKey: string): Promise<string> {
  const model = process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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

async function callGemini(messages: AiMessage[], apiKey: string): Promise<string> {
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
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
 * Pollinations.ai - free, no API key required. Used as the default so the
 * Assistant works for everyone out of the box. Their POST endpoint accepts
 * OpenAI-style message arrays and returns plain text.
 */
async function callPollinations(messages: AiMessage[]): Promise<string> {
  const model = process.env.POLLINATIONS_MODEL ?? DEFAULT_POLLINATIONS_MODEL;
  const res = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      model,
      private: true,         // don't surface our prompts in their public feed
      seed: Math.floor(Math.random() * 1_000_000),
    }),
  });
  if (!res.ok) {
    throw new Error(`Pollinations ${res.status}`);
  }
  const text = (await res.text()).trim();
  return text || "Sorry, I didn't catch that.";
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    messages?: AiMessage[];
    conversationId?: string | null;
  };
  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Build the provider chain dynamically based on which keys are configured.
  const providers: Array<{ name: "groq" | "gemini" | "pollinations"; run: () => Promise<string> }> = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({ name: "groq", run: () => callGroq(messages, process.env.GROQ_API_KEY!) });
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push({ name: "gemini", run: () => callGemini(messages, process.env.GEMINI_API_KEY!) });
  }
  // Always include Pollinations as the safety net so the Assistant works even
  // with no env vars set at all.
  providers.push({ name: "pollinations", run: () => callPollinations(messages) });

  let reply = "";
  let usedProvider: "groq" | "gemini" | "pollinations" | "demo" = "demo";
  const errors: string[] = [];

  for (const p of providers) {
    try {
      reply = await p.run();
      usedProvider = p.name;
      break;
    } catch (err) {
      errors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
      console.warn(`[ai/chat] ${p.name} failed:`, err);
    }
  }

  if (!reply) {
    // Last resort - canned demo so the UI never breaks
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    reply = cannedReply(lastUserMsg);
    usedProvider = "demo";
  }

  // ── Persist the conversation ──────────────────────────────────────────
  const updatedMessages: AiMessage[] = [...messages, { role: "assistant", content: reply }];
  let conversationId: string | null = body.conversationId ?? null;
  try {
    if (conversationId) {
      const { error } = await supabase
        .from("ai_conversations")
        .update({ messages: updatedMessages })
        .eq("id", conversationId)
        .eq("user_id", user.id);
      if (error && !isMissingTableError(error)) {
        console.warn("[ai/chat] update failed:", error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title: deriveTitle(messages),
          messages: updatedMessages,
        })
        .select("id")
        .maybeSingle();
      if (error) {
        if (!isMissingTableError(error)) {
          console.warn("[ai/chat] insert failed:", error.message);
        }
      } else if (data?.id) {
        conversationId = data.id as string;
      }
    }
  } catch (err) {
    console.warn("[ai/chat] persistence error:", err);
  }

  return NextResponse.json({
    reply,
    conversationId,
    provider: usedProvider,
    ...(usedProvider === "demo" ? { simulated: true, providerErrors: errors } : {}),
  });
}

/** Last-resort canned replies if every upstream provider failed. */
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
