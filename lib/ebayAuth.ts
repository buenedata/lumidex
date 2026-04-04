/**
 * eBay OAuth 2.0 – Client Credentials Grant
 *
 * Fetches an Application token scoped to public eBay data
 * (https://api.ebay.com/oauth/api_scope).
 *
 * Token lifetime is ~2 hours. This module uses a two-layer cache:
 *   1. In-memory  — fastest; valid for the life of the same serverless instance.
 *   2. Supabase   — survives cold starts; single row in ebay_oauth_tokens table.
 *
 * Usage:
 *   import { getEbayAppToken } from '@/lib/ebayAuth';
 *   const token = await getEbayAppToken();
 *   // → "Bearer v^1.1…"   (use directly in Authorization header)
 */

import { supabaseAdmin } from './supabase';

const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_SCOPE     = 'https://api.ebay.com/oauth/api_scope';
const TOKEN_KEY      = 'client_credentials'; // singleton row key
const EXPIRY_BUFFER  = 60_000; // refresh 60s before actual expiry

// ── In-memory cache (same serverless invocation) ──────────────────────────
let memToken: string | null = null;
let memExpiresAt = 0;

/**
 * Returns a valid eBay Application access token.
 * Refreshes automatically when expired (with Supabase-backed persistence).
 */
export async function getEbayAppToken(): Promise<string> {
  const now = Date.now();

  // 1. In-memory hit — fastest path
  if (memToken && memExpiresAt > now + EXPIRY_BUFFER) {
    return memToken;
  }

  // 2. Supabase cache hit — survives cold starts
  try {
    const { data } = await supabaseAdmin
      .from('ebay_oauth_tokens')
      .select('access_token, expires_at')
      .eq('token_key', TOKEN_KEY)
      .maybeSingle();

    if (data?.access_token) {
      const dbExpiry = new Date(data.expires_at).getTime();
      if (dbExpiry > now + EXPIRY_BUFFER) {
        memToken     = data.access_token;
        memExpiresAt = dbExpiry;
        return data.access_token; // return concrete string, not nullable var
      }
    }
  } catch (err) {
    // Non-fatal — fall through to fetch a fresh token
    console.warn('[ebayAuth] Supabase cache read failed:', err);
  }

  // 3. Fetch a fresh token from eBay
  return refreshToken(now);
}

// ── Internal: fetch + persist ─────────────────────────────────────────────

async function refreshToken(now: number): Promise<string> {
  const clientId     = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('[ebayAuth] Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET env variables');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope:      EBAY_SCOPE,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[ebayAuth] Token request failed: ${response.status} — ${text}`);
  }

  const json = await response.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(now + json.expires_in * 1000);

  // Persist to Supabase (upsert the singleton row)
  try {
    await supabaseAdmin
      .from('ebay_oauth_tokens')
      .upsert(
        {
          token_key:    TOKEN_KEY,
          access_token: json.access_token,
          expires_at:   expiresAt.toISOString(),
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'token_key' }
      );
  } catch (err) {
    // Non-fatal — token is still usable, Supabase write just failed
    console.warn('[ebayAuth] Supabase cache write failed:', err);
  }

  // Update in-memory cache
  memToken     = json.access_token;
  memExpiresAt = expiresAt.getTime();

  console.log(`[ebayAuth] Refreshed eBay token; expires at ${expiresAt.toISOString()}`);
  return memToken;
}
