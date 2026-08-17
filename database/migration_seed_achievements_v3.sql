-- ============================================================
-- Lumidex — Seed Achievements v3
-- Adds 13 new achievements across 4 new categories:
--   Pokémon Trainer, Moomin Collector, Graded Cards, General Collecting
-- Safe to re-run (ON CONFLICT DO NOTHING).
-- Requires migration_seed_achievements.sql (unique index on name).
-- Run once in Supabase SQL editor.
-- ============================================================

INSERT INTO public.achievements (name, description, icon) VALUES

  -- ── Pokémon Trainer ───────────────────────────────────────────────────────
  ('Pokémon Trainer', 'Start tracking your first Pokémon set',          '🎮'),
  ('Gym Leader',      'Complete your first Pokémon set',                '🥊'),
  ('Elite Four',      'Complete 4 Pokémon sets',                        '🏅'),
  ('Champion',        'Defeat the Champion — complete 10 Pokémon sets', '🏆'),
  ('Pokémon Master',  'Master them all — complete 25 Pokémon sets',     '👑'),

  -- ── Moomin Collector ─────────────────────────────────────────────────────
  ('Moomin Explorer',  'Start tracking your first Moomin set',          '🌿'),
  ('Valley Dweller',   'Complete your first Moomin set',                '🏡'),
  ('Moomin Collector', 'Complete 3 Moomin sets',                        '🌊'),

  -- ── Graded Cards ─────────────────────────────────────────────────────────
  ('Grader''s Apprentice', 'Submit your first card for grading',        '🔬'),
  ('Graded Investor',      'Build a graded collection of 10 slabs',     '💰'),
  ('Slab Master',          'Accumulate 50 graded slabs',                '🏛️'),

  -- ── General / Multi-game Collecting ─────────────────────────────────────
  ('World Collector', 'Collect across 2 different TCGs',               '🌍'),
  ('List Maker',      'Create your first custom list',                  '📝'),
  ('Curator',         'Curate 5 custom lists',                          '🖼️')

ON CONFLICT (name) DO NOTHING;
