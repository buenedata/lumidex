-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill user_cards for graded-only cards
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Context
-- ───────
-- The graded-card POST endpoint (/api/graded-cards) was fixed to write the
-- combined quantity (graded + regular variants) to user_cards after every
-- upsert.  However, any user_graded_cards rows that were inserted BEFORE that
-- fix was deployed have no corresponding user_cards entry, so those cards
-- still show quantity = 0 in the UI (e.g. Carmine #217 / Twilight Masquerade).
--
-- What this migration does
-- ────────────────────────
-- For every (user_id, card_id) pair that exists in user_graded_cards it
-- computes the authoritative total quantity:
--
--   total = SUM(user_graded_cards.quantity)
--         + COALESCE(SUM(user_card_variants.quantity), 0)
--
-- …and upserts that value into user_cards.  The ON CONFLICT clause ensures
-- rows that already have the correct quantity are left untouched, and rows
-- that exist but carry a stale quantity (too low) are brought up to date.
--
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO user_cards (user_id, card_id, quantity)
SELECT
  g.user_id,
  g.card_id,
  g.graded_qty + COALESCE(v.variant_qty, 0) AS quantity
FROM (
  -- Grand total of graded copies per user per card
  SELECT
    user_id,
    card_id,
    SUM(quantity) AS graded_qty
  FROM user_graded_cards
  WHERE quantity > 0
  GROUP BY user_id, card_id
) g
LEFT JOIN (
  -- Grand total of standard variant copies per user per card
  SELECT
    user_id,
    card_id,
    SUM(quantity) AS variant_qty
  FROM user_card_variants
  WHERE quantity > 0
  GROUP BY user_id, card_id
) v ON v.user_id = g.user_id
   AND v.card_id = g.card_id
ON CONFLICT (user_id, card_id)
DO UPDATE
  SET quantity = EXCLUDED.quantity
  -- Only write if the stored value differs — avoids unnecessary row churn
  -- and keeps the updated_at timestamp accurate on tables that have one.
  WHERE user_cards.quantity IS DISTINCT FROM EXCLUDED.quantity;
