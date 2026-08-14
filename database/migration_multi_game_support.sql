-- Migration: Multi-game support (Phase 1)
-- Adds `game` column to `sets` and `variants` tables.
-- All existing Pokémon data defaults to game = 'pokemon'.
-- Pokémon-specific variants are scoped with game = 'pokemon'.
-- NULL game on variants means globally applicable (e.g., 'normal').
-- New lib/games.ts provides the central game configuration registry.

-- 1. Add `game` column to `sets` table
ALTER TABLE sets ADD COLUMN IF NOT EXISTS game text NOT NULL DEFAULT 'pokemon';

CREATE INDEX IF NOT EXISTS idx_sets_game ON sets(game);

-- 2. Add `game` column to `variants` table
--    NULL = globally applicable variant (e.g., 'normal', 'first_edition')
--    'pokemon' = Pokémon-specific variant
--    'moomin'  = Moomin-specific variant (future use)
ALTER TABLE variants ADD COLUMN IF NOT EXISTS game text NULL;

-- 3. Backfill known Pokémon-specific variants
UPDATE variants SET game = 'pokemon'
WHERE key IN ('reverse', 'holo', 'pokeball', 'masterball', 'cosmos_holo', 'promo');
