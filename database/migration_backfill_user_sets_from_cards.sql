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
-- Fix part 1: derive all missing user_sets rows from the actual
-- card ownership data (user_card_variants JOIN cards).
--
-- Fix part 2: directly award all game-specific achievements
-- ('Pokémon Trainer', 'Moomin Explorer') to every user who
-- already qualifies — without requiring them to self-visit their
-- profile page (which is the only other trigger for the check).
--
-- Safe to re-run — ON CONFLICT DO NOTHING everywhere.
-- ============================================================

-- ── Step 1: Populate user_sets ────────────────────────────────────────────────

INSERT INTO public.user_sets (user_id, set_id)
SELECT DISTINCT
  ucv.user_id,
  c.set_id
FROM public.user_card_variants ucv
JOIN public.cards c ON c.id = ucv.card_id
WHERE ucv.quantity > 0
  AND c.set_id IS NOT NULL
ON CONFLICT (user_id, set_id) DO NOTHING;

-- ── Step 2: Award 'Pokémon Trainer' to all users with ≥1 Pokémon set ─────────
-- user_achievements has no unique constraint on (user_id, achievement_id),
-- so we guard with WHERE NOT EXISTS to avoid duplicates.

INSERT INTO public.user_achievements (user_id, achievement_id)
SELECT DISTINCT us.user_id, a.id
FROM public.user_sets  us
JOIN public.sets        s ON s.set_id = us.set_id AND s.game = 'pokemon'
JOIN public.achievements a ON a.name  = 'Pokémon Trainer'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_achievements ua
  WHERE ua.user_id = us.user_id AND ua.achievement_id = a.id
);

-- ── Step 3: Award 'Moomin Explorer' to all users with ≥1 Moomin set ──────────

INSERT INTO public.user_achievements (user_id, achievement_id)
SELECT DISTINCT us.user_id, a.id
FROM public.user_sets  us
JOIN public.sets        s ON s.set_id = us.set_id AND s.game = 'moomin'
JOIN public.achievements a ON a.name  = 'Moomin Explorer'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_achievements ua
  WHERE ua.user_id = us.user_id AND ua.achievement_id = a.id
);

-- ── Step 4: Award 'Collector' (≥1 set tracked) to all users missing it ───────

INSERT INTO public.user_achievements (user_id, achievement_id)
SELECT DISTINCT us.user_id, a.id
FROM public.user_sets  us
JOIN public.achievements a ON a.name = 'Collector'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_achievements ua
  WHERE ua.user_id = us.user_id AND ua.achievement_id = a.id
);
