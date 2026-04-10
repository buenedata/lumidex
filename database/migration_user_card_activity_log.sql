-- ============================================================
-- Migration: user_card_activity_log
-- Appends one row per quantity change so Last Activity can
-- display the full per-variant history (e.g. ↓2→1 and ↑1→2
-- as separate events for the same card).
--
-- Run AFTER migration_add_quantity_delta.sql.
-- Run once in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_card_activity_log (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL,   -- FK → users.id
    card_id      uuid        NOT NULL,   -- FK → cards.id
    variant_id   uuid        NOT NULL,   -- FK → variants.id
    variant_type text,                   -- legacy label, e.g. 'normal', 'reverse'
    old_quantity integer     NOT NULL DEFAULT 0,
    new_quantity integer     NOT NULL,
    changed_at   timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_card_activity_log ENABLE ROW LEVEL SECURITY;

-- Service-role API writes bypass RLS; only a SELECT policy is needed for
-- potential future client-side reads.
CREATE POLICY "Users can view their own card activity log."
    ON public.user_card_activity_log FOR SELECT
    USING (auth.uid() = user_id);

-- ── Index ─────────────────────────────────────────────────────────────────────
-- Efficient ORDER BY changed_at DESC with user_id filter for Last Activity queries.
CREATE INDEX IF NOT EXISTS idx_card_activity_log_user_changed
    ON public.user_card_activity_log (user_id, changed_at DESC);
