-- ============================================================
-- Lumidex — User Card Lists Migration
-- Adds: user_card_lists and user_card_list_items tables
-- Run once in Supabase SQL editor.
-- ============================================================
-- Users can create named lists (e.g. "Yuka Collection") and add
-- cards to them from any card modal.  Lists can be public or
-- private (default: private, controlled per-list and by user
-- preference lists_public_by_default).
-- ============================================================

-- ── user_card_lists ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_card_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  is_public   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- All lists for a user
CREATE INDEX IF NOT EXISTS user_card_lists_user_id_idx
  ON public.user_card_lists (user_id);

-- ── user_card_list_items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_card_list_items (
  id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id  uuid        NOT NULL REFERENCES public.user_card_lists(id) ON DELETE CASCADE,
  card_id  uuid        NOT NULL REFERENCES public.cards(id)           ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),

  -- Each card may appear only once per list
  CONSTRAINT user_card_list_items_list_card_key UNIQUE (list_id, card_id)
);

-- All items in a list (pagination / display)
CREATE INDEX IF NOT EXISTS user_card_list_items_list_id_idx
  ON public.user_card_list_items (list_id);

-- Which lists contain a given card (dropdown membership check)
CREATE INDEX IF NOT EXISTS user_card_list_items_card_id_idx
  ON public.user_card_list_items (card_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.user_card_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_card_list_items ENABLE ROW LEVEL SECURITY;

-- ── Policies: user_card_lists ─────────────────────────────────────────────────

-- Owner can read own lists; anyone can read public lists
CREATE POLICY "user_card_lists_owner_select"
  ON public.user_card_lists FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

-- Only owner can create lists
CREATE POLICY "user_card_lists_owner_insert"
  ON public.user_card_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only owner can rename / toggle visibility
CREATE POLICY "user_card_lists_owner_update"
  ON public.user_card_lists FOR UPDATE
  USING (auth.uid() = user_id);

-- Only owner can delete
CREATE POLICY "user_card_lists_owner_delete"
  ON public.user_card_lists FOR DELETE
  USING (auth.uid() = user_id);

-- Admins bypass all restrictions
CREATE POLICY "user_card_lists_admin_all"
  ON public.user_card_lists FOR ALL
  USING (public.is_admin());

-- ── Policies: user_card_list_items ────────────────────────────────────────────

-- Readable if the parent list is owned by current user or is public
CREATE POLICY "user_card_list_items_select"
  ON public.user_card_list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_card_lists l
      WHERE l.id = list_id
        AND (l.user_id = auth.uid() OR l.is_public = true)
    )
  );

-- Insertable only when the list belongs to current user
CREATE POLICY "user_card_list_items_owner_insert"
  ON public.user_card_list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_card_lists l
      WHERE l.id = list_id AND l.user_id = auth.uid()
    )
  );

-- Deletable only when the list belongs to current user
CREATE POLICY "user_card_list_items_owner_delete"
  ON public.user_card_list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_card_lists l
      WHERE l.id = list_id AND l.user_id = auth.uid()
    )
  );

-- Admins bypass all restrictions
CREATE POLICY "user_card_list_items_admin_all"
  ON public.user_card_list_items FOR ALL
  USING (public.is_admin());
