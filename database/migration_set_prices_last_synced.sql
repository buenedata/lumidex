-- Migration: add prices_last_synced_at to sets table
-- Tracks when a set's card prices were last updated by the automatic cron job.
-- NULL = never synced (highest priority for the scheduler).

ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS prices_last_synced_at TIMESTAMPTZ DEFAULT NULL;

-- Index to efficiently query "which sets are due for a price update?"
CREATE INDEX IF NOT EXISTS idx_sets_prices_last_synced_at
  ON sets (prices_last_synced_at);
