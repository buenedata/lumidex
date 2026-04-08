-- ============================================================
-- Lumidex — Trade Proposals Migration
-- Adds: trade_proposals + trade_proposal_items tables
-- Run once in Supabase SQL editor.
-- ============================================================
-- trade_proposals stores the negotiation header.
-- trade_proposal_items stores per-card lines (offering / requesting).
-- ============================================================

-- ── trade_proposals ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_proposals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','accepted','declined','withdrawn')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trade_proposals_no_self CHECK (proposer_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS trade_proposals_proposer_idx ON public.trade_proposals (proposer_id, status);
CREATE INDEX IF NOT EXISTS trade_proposals_receiver_idx ON public.trade_proposals (receiver_id, status);

-- ── trade_proposal_items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_proposal_items (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  uuid    NOT NULL REFERENCES public.trade_proposals(id) ON DELETE CASCADE,
  card_id      uuid    NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  direction    text    NOT NULL CHECK (direction IN ('offering','requesting')),
  quantity     integer NOT NULL DEFAULT 1 CHECK (quantity >= 1)
);

CREATE INDEX IF NOT EXISTS trade_proposal_items_proposal_idx ON public.trade_proposal_items (proposal_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE TRIGGER handle_updated_at_trade_proposals
  BEFORE UPDATE ON public.trade_proposals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.trade_proposals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_proposal_items ENABLE ROW LEVEL SECURITY;

-- Proposals: each party can read
CREATE POLICY "trade_proposals_parties_select"
  ON public.trade_proposals FOR SELECT
  USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

-- Only the proposer can create
CREATE POLICY "trade_proposals_proposer_insert"
  ON public.trade_proposals FOR INSERT
  WITH CHECK (auth.uid() = proposer_id);

-- Either party can update status (accept / decline / withdraw)
CREATE POLICY "trade_proposals_parties_update"
  ON public.trade_proposals FOR UPDATE
  USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

-- Items: readable if the parent proposal is readable by the user
CREATE POLICY "trade_proposal_items_select"
  ON public.trade_proposal_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_proposals p
      WHERE p.id = proposal_id
        AND (p.proposer_id = auth.uid() OR p.receiver_id = auth.uid())
    )
  );

-- Items: insertable if the user is the proposer of the parent proposal
CREATE POLICY "trade_proposal_items_insert"
  ON public.trade_proposal_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trade_proposals p
      WHERE p.id = proposal_id AND p.proposer_id = auth.uid()
    )
  );

-- Admins can manage all proposals
CREATE POLICY "trade_proposals_admin_all"
  ON public.trade_proposals FOR ALL
  USING (public.is_admin());

CREATE POLICY "trade_proposal_items_admin_all"
  ON public.trade_proposal_items FOR ALL
  USING (public.is_admin());
