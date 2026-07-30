-- ─────────────────────────────────────────────────────────────────────────
-- Migration 003: ai_conversations
-- Stores each user's AI Assistant chat history so they can revisit past
-- conversations like ChatGPT. Each row = one full conversation.
--
-- Messages are stored as a jsonb array of { role, content } objects.
-- A separate table would be cleaner for very long chats, but for a CRM
-- assistant a single row keeps reads + writes single-roundtrip.
--
-- Apply: Supabase Dashboard -> SQL Editor -> paste this file -> Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE everywhere).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sidebar fetches "newest first" - this index makes that O(log n).
CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx
  ON public.ai_conversations (user_id, updated_at DESC);

-- ─── Row Level Security ─────────────────────────────────────────────────
-- Every query is scoped to the signed-in user. The service-role client
-- bypasses RLS, so server routes still work normally.

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own conversations" ON public.ai_conversations;
CREATE POLICY "Users manage their own conversations"
  ON public.ai_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Updated-at trigger ─────────────────────────────────────────────────
-- Keeps updated_at fresh whenever a row changes, so the sidebar can sort
-- by recency without the app having to remember to bump it on every save.

CREATE OR REPLACE FUNCTION public.set_ai_conversations_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_conversations_set_updated_at ON public.ai_conversations;
CREATE TRIGGER ai_conversations_set_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ai_conversations_updated_at();
