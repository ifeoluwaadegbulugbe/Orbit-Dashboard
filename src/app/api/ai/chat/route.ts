import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeChat } from "@/lib/ai/complete";
import type { AiMessage } from "@/types";

/**
 * AI Assistant - persistent, freeform chat backed by a free LLM provider.
 * Provider selection lives in src/lib/ai/complete.ts, shared with the
 * embedded suggestion endpoint (api/ai/suggest).
 */

const SYSTEM_PROMPT = `You are the Orbit AI Assistant - a warm, practical business coach for service-business owners (freelancers, nail techs, makeup artists, tutors, photographers, coaches, repair techs, event planners, home service providers). Many of your users run small businesses in Nigeria and across Africa - keep that context in mind.

Style:
- Speak like a friend who's also a business advisor - encouraging, never corporate.
- Keep answers concise (2-4 short paragraphs max).
- Use specific, actionable suggestions, not generic advice.
- Ask one clarifying question if needed, otherwise just help.

Topics you help with: client follow-ups, pricing, payment reminders, retention, scaling, marketing copy, booking flows, invoicing tone.

Never: discuss politics, give legal/medical advice, or recommend specific paid tools beyond Orbit's built-in features.`;

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

  const { reply, provider, simulated, providerErrors } = await completeChat(messages, SYSTEM_PROMPT);

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
    provider,
    ...(simulated ? { simulated: true, providerErrors } : {}),
  });
}
