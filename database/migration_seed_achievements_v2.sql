-- ============================================================
-- Lumidex — Seed Achievements v2
-- Adds 26 new achievements across 6 new and 3 extended categories.
-- Safe to re-run (ON CONFLICT DO NOTHING).
-- Requires migration_seed_achievements.sql to have been run first
-- (sets up the unique index on name).
-- Run once in Supabase SQL editor.
-- ============================================================

INSERT INTO public.achievements (name, description, icon) VALUES

  -- ── Collection Size (total quantity) ─────────────────────────────────────
  ('Elite Collector',    'Amass a collection of 2,500 cards',        '🏅'),
  ('Master Vault',       'Unlock the vault with 5,000 cards',         '🗝️'),
  ('Legendary Hoard',    'Reach a legendary 10,000 cards',            '⚡'),
  ('Card Emperor',       'Rule the collection with 25,000 cards',     '👸'),

  -- ── Unique Cards (distinct card_ids) ─────────────────────────────────────
  ('Card Hunter',         'Discover 10 unique cards',                  '🔍'),
  ('Dedicated Collector', 'Own 250 different cards',                   '📚'),
  ('Thousand Faces',      'Own 1,000 different cards',                 '🃏'),
  ('Card Archivist',      'Catalogue 5,000 unique cards',              '🗄️'),

  -- ── Sets Tracked ─────────────────────────────────────────────────────────
  ('Set Explorer',   'Track 5 different sets',            '🧭'),
  ('Set Hoarder',    'Track 15 different sets',           '📋'),
  ('Set Chronicler', 'Track 30 different sets',           '📜'),
  ('Set Archivist',  'Track 50 different sets',           '🏛️'),

  -- ── Set Completion ────────────────────────────────────────────────────────
  ('Set Perfectionist', 'Complete 25 sets',               '🎖️'),
  ('Living Pokédex',    'Complete 50 sets',               '🌈'),

  -- ── Duplicates ────────────────────────────────────────────────────────────
  ('Double Trouble', 'Accumulate 50 duplicate cards',                  '🔄'),
  ('Trade Ready',    'Stock up 200 duplicate cards ready to trade',    '💼'),

  -- ── Wanted List ───────────────────────────────────────────────────────────
  ('Wishful Thinking',    'Add your first card to the wanted list',    '🌠'),
  ('On the Hunt',         'Track 25 cards on your wanted list',        '🔭'),
  ('Obsessive Collector', 'Hunt down 100 wanted cards',                '📌'),

  -- ── Sealed Products ───────────────────────────────────────────────────────
  ('Sealed Ambitions', 'Add your first sealed product',               '🎴'),
  ('Box Hoarder',      'Collect 10 sealed products',                  '🎁'),
  ('Sealed Vault',     'Build a sealed vault of 50 products',         '🔐'),

  -- ── Social ────────────────────────────────────────────────────────────────
  ('Network Builder',  'Connect with 10 friends',                     '🌐'),
  ('Community Pillar', 'Build a network of 25 friends',               '🏘️'),

  -- ── Profile ───────────────────────────────────────────────────────────────
  ('Picture Perfect', 'Upload a profile avatar',                      '📸'),
  ('Identity',        'Complete your profile setup',                  '🪪')

ON CONFLICT (name) DO NOTHING;
