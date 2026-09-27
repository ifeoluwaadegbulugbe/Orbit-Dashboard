import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeChat } from "@/lib/ai/complete";

/**
 * Stateless AI suggestions embedded on Home/Clients/Money - a single
 * short, purpose-built draft, not a saved conversation. This is the
 * "AI as a layer, not a destination" piece of orbit-overhaul.md §7/§8.
 */

const SYSTEM_PROMPT = `You are Orbit's business coach, drafting a single short suggestion for a service-business owner (many run small businesses in Nigeria/Africa). Reply with ONLY the requested draft or suggestion - no preamble, no "Here's a draft:", no sign-off asking if they want changes. Keep it warm but brief (2-5 sentences for a message draft).`;

type SuggestKind = "invoice_chase" | "client_followup" | "home_digest";

interface SuggestBody {
  kind?: SuggestKind;
  context?: {
    clientName?: string;
    amount?: string;
    daysOverdue?: number;
    daysSinceContact?: number;
    overdueCount?: number;
    followUpCount?: number;
  };
}

function buildPrompt(kind: SuggestKind, context: SuggestBody["context"]): string | null {
  switch (kind) {
    case "invoice_chase": {
      const { clientName, amount, daysOverdue } = context ?? {};
      if (!clientName) return null;
      const overdueLine = daysOverdue && daysOverdue > 0
        ? `It's ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue.`
        : "It's due soon.";
      return `Draft a short, friendly payment reminder message to send to my client ${clientName}${amount ? ` for ${amount}` : ""}. ${overdueLine} Keep it polite but clear, suitable to send over WhatsApp.`;
    }
    case "client_followup": {
      const { clientName, daysSinceContact } = context ?? {};
      if (!clientName) return null;
      return `Draft a short, warm follow-up message to send to my client ${clientName}, who I haven't been in touch with in ${daysSinceContact ?? "a while"} days. I want to check in and see if they'd like to rebook, without being pushy.`;
    }
    case "home_digest": {
      const { overdueCount, followUpCount } = context ?? {};
      return `Give me one short, encouraging sentence of business advice for today. I have ${overdueCount ?? 0} overdue invoices and ${followUpCount ?? 0} clients due for a follow-up. Be specific to that, not generic.`;
    }
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SuggestBody;
  if (!body.kind) {
    return NextResponse.json({ error: "Missing kind" }, { status: 400 });
  }

  const prompt = buildPrompt(body.kind, body.context);
  if (!prompt) {
    return NextResponse.json({ error: "Missing required context for this suggestion" }, { status: 400 });
  }

  const { reply } = await completeChat([{ role: "user", content: prompt }], SYSTEM_PROMPT);
  return NextResponse.json({ suggestion: reply });
}
