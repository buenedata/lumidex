-- Migration: card_variant_availability
-- Per-card variant configuration override table.
--
-- When rows exist for a card, ONLY those variants are available for that card
-- (overrides the global rarity-based rules).
-- When NO rows exist for a card, the system falls back to automatic rarity rules
-- (Normal+Reverse for common, Reverse+Holo for holo rares, Holo only for EX/V/Secret).
--
-- Run this in the Supabase SQL Editor.

create table if not exists card_variant_availability (
  id          uuid default gen_random_uuid() primary key,
  card_id     uuid not null references cards(id) on delete cascade,
  variant_id  uuid not null references variants(id) on delete cascade,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  constraint  unique_card_variant unique (card_id, variant_id)
);

create index if not exists idx_cva_card_id    on card_variant_availability(card_id);
create index if not exists idx_cva_variant_id on card_variant_availability(variant_id);

-- Enable RLS
alter table card_variant_availability enable row level security;

-- Anyone (incl. unauthenticated) can read — needed by the public variants API
create policy "cva_read_all"
  on card_variant_availability for select
  using (true);

-- Only service-role (used by supabaseAdmin in API routes) can write.
-- No explicit policy needed for service-role; it bypasses RLS.
