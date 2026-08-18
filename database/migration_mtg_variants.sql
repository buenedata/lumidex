-- Migration: MTG-specific variants
-- Adds 'foil' and 'etched' variants scoped to game = 'mtg'.
-- The global 'normal' variant (game IS NULL) already applies to all MTG cards.
--
-- Run this after migration_multi_game_support.sql.

INSERT INTO variants (key, name, description, color, short_label, is_quick_add, sort_order, is_official, game)
VALUES
  ('foil',   'Foil',        'Standard foil treatment',      'blue', 'F',  true,  10, true, 'mtg'),
  ('etched', 'Etched Foil', 'Etched holofoil treatment',    'teal', 'EF', false, 11, true, 'mtg')
ON CONFLICT (key) DO NOTHING;
