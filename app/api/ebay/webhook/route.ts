import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Token you registered in the eBay Developer Portal Notification settings.
// Must be set in .env.local (local) and Vercel Environment Variables (prod).
// Example: EBAY_VERIFICATION_TOKEN=my-secret-token-abc123
const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN;

// This must exactly match the endpoint URL you entered in the eBay portal.
const ENDPOINT = 'https://lumidex.app/api/ebay/webhook';

// ──────────────────────────────────────────────────────────────
// GET — eBay challenge verification
// eBay sends: GET /api/ebay/webhook?challenge_code=<code>
// We respond: { challengeResponse: sha256(code + token + endpoint) }
// ──────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const challengeCode = searchParams.get('challenge_code');

  if (!challengeCode) {
    return NextResponse.json({ error: 'Missing challenge_code' }, { status: 400 });
  }

  if (!VERIFICATION_TOKEN) {
    console.error('[eBay webhook] EBAY_VERIFICATION_TOKEN is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const hash = crypto
    .createHash('sha256')
    .update(challengeCode + VERIFICATION_TOKEN + ENDPOINT)
    .digest('hex');

  return NextResponse.json({ challengeResponse: hash });
}

// ──────────────────────────────────────────────────────────────
// POST — Receive eBay notification events
// eBay sends a JSON body describing the marketplace event.
// We log it to Supabase for later processing.
// ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log('[eBay webhook] Received event:', JSON.stringify(body));

    const { error } = await supabaseAdmin.from('ebay_webhooks').insert({
      payload: body,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[eBay webhook] Supabase insert error:', error.message);
      return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[eBay webhook] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
