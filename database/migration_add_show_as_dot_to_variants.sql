-- Migration: add show_as_dot to variants
-- Controls whether a card-specific variant renders as a coloured quantity dot under
-- the card image on set/browse pages.
--
-- Global variants (card_id IS NULL) default to true  — they always show as dots.
-- Card-specific variants (card_id IS NOT NULL) default to false — admin must
-- explicitly enable each one from the card details modal using the new ⬤ toggle.
--
-- Run in the Supabase SQL Editor.

alter table variants add column if not exists show_as_dot boolean not null default false;

-- Backfill 1: global variants have always been shown as dots.
update variants set show_as_dot = true where card_id is null;

-- Backfill 2: card-specific variants that were already added to card_variant_availability
-- were previously shown as dots via the hasOverride heuristic — preserve that behaviour.
update variants v
set show_as_dot = true
where v.card_id is not null
  and exists (
    select 1 from card_variant_availability cva
    where cva.variant_id = v.id
  );
