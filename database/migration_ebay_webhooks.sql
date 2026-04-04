-- ============================================================
-- Migration: Add ebay_webhooks table
-- Purpose:   Stores raw eBay notification webhook payloads
--            for auditing and future event processing.
--            Inserts are performed server-side via supabaseAdmin
--            (service role) so no user-facing RLS policies are needed.
-- Run in:    Supabase SQL editor or via CLI
-- ============================================================

create table if not exists public.ebay_webhooks (
    id         uuid not null default gen_random_uuid() primary key,
    payload    jsonb,
    created_at timestamp without time zone default now()
);

-- Index on created_at for chronological queries / cleanup jobs
create index if not exists ebay_webhooks_created_at_idx
    on public.ebay_webhooks (created_at desc);
