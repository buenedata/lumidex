-- ============================================================
-- Lumidex — Seed Achievements
-- Seeds the achievements table with all defined achievements.
-- Safe to re-run (ON CONFLICT DO NOTHING requires unique index on name).
-- Run once in Supabase SQL editor.
-- ============================================================

-- Ensure a unique index on name exists (allows ON CONFLICT to work)
-- CREATE INDEX IF NOT EXISTS is safe to re-run; underlying constraint is implicit.
CREATE UNIQUE INDEX IF NOT EXISTS achievements_name_key
  ON public.achievements (name);

-- Seed all achievements
INSERT INTO public.achievements (name, description, icon) VALUES
  ('First Steps',         'Add your first card to your collection',   '🎯'),
  ('Collector',           'Start tracking your first set',             '📦'),
  ('Century Club',        'Collect 100 cards',                         '💯'),
  ('Enthusiast',          'Collect 500 cards',                         '⭐'),
  ('Completionist',       'Complete your first set',                   '🏆'),
  ('Master Collector',    'Complete 5 sets',                           '👑'),
  ('Friend Finder',       'Add your first friend',                     '🤝'),
  ('Social Butterfly',    'Have 5 friends in your network',            '🦋'),
  ('Diamond Collector',   'Collect 1,000 cards',                       '💎'),
  ('Legend',              'Complete 10 sets',                          '🌟')
ON CONFLICT (name) DO NOTHING;
