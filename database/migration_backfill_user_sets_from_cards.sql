-- ============================================================
-- Lumidex — Backfill user_sets from user_card_variants
--
-- Problem: the server-side /api/user-card-variants route never
-- wrote to user_sets, so users who added cards through the UI
-- (which calls the API route) ended up with empty user_sets
-- even though they owned cards in multiple sets.
--
-- This means game-specific achievements like 'Pokémon Trainer'
-- (pokemonSetsTracked >= 1) never fired because getUserStats()
-- derives pokemonSetsTracked from user_sets, not user_card_variants.
--
-- Fix: derive all missing user_sets rows from the actual card
-- ownership data (user_card_variants JOIN cards).
-- Safe to re-run — ON CONFLICT DO NOTHING.
-- ============================================================

INSERT INTO public.user_sets (user_id, set_id)
SELECT DISTINCT
  ucv.user_id,
  c.set_id
FROM public.user_card_variants ucv
JOIN public.cards c ON c.id = ucv.card_id
WHERE ucv.quantity > 0
  AND c.set_id IS NOT NULL
ON CONFLICT (user_id, set_id) DO NOTHING;
