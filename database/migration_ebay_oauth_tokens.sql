-- ============================================================
-- Migration: Add ebay_oauth_tokens table
-- Purpose:   Caches the eBay Application (Client Credentials)
--            OAuth token so that serverless cold starts don't
--            each burn a separate token-fetch round-trip.
--            A single row keyed on 'client_credentials' is
--            upserted by lib/ebayAuth.ts whenever the cached
--            token is within 60s of expiry.
-- Run in:    Supabase SQL editor or via CLI
-- ============================================================

create table if not exists public.ebay_oauth_tokens (
    token_key    text primary key,        -- always 'client_credentials'
    access_token text not null,
    expires_at   timestamptz not null,
    updated_at   timestamptz not null default now()
);
