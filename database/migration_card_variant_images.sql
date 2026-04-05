-- Migration: card_variant_images
-- Stores per-card, per-variant image URLs for the variant hover feature.
--
-- When a row exists for (card_id, variant_id), hovering that variant in the card
-- modal cross-fades the large card image to this variant-specific image.
-- When NO row exists, hovering has no visual effect on the card image.
--
-- Run this in the Supabase SQL Editor.

create table if not exists public.card_variant_images (
  id          uuid not null default gen_random_uuid() primary key,
  card_id     uuid not null references public.cards(id) on delete cascade,
  variant_id  uuid not null references public.variants(id) on delete cascade,
  image_url   text not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint unique_card_variant_image unique (card_id, variant_id)
);

create index if not exists idx_cvi_card_id    on public.card_variant_images(card_id);
create index if not exists idx_cvi_variant_id on public.card_variant_images(variant_id);

-- Enable RLS
alter table public.card_variant_images enable row level security;

-- Anyone (incl. unauthenticated) can read — needed by the public variants API
create policy "cvi_read_all"
  on public.card_variant_images for select
  using (true);

-- Writes: service role only (API routes use supabaseAdmin which bypasses RLS).
-- No explicit insert/update/delete policy needed for service-role.
