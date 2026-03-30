import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

/**
 * GET /api/featurebase-jwt
 *
 * Returns a signed HS256 JWT for the currently authenticated user,
 * formatted as required by the Featurebase SSO / widget identification spec.
 *
 * Required environment variable:
 *   FEATUREBASE_JWT_SECRET — copy from your Featurebase workspace:
 *   Settings → Integrations → JWT Authentication → Secret
 *
 * Featurebase JWT payload shape:
 *   { email, userId, name? }
 */
export async function GET() {
  const secret = process.env.FEATUREBASE_JWT_SECRET

  if (!secret) {
    return NextResponse.json(
      { error: 'FEATUREBASE_JWT_SECRET is not configured.' },
      { status: 500 }
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    // Unauthenticated — return 401 so the widget falls back to anonymous mode
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const payload: Record<string, string> = {
    userId: user.id,
    email: user.email ?? '',
  }

  // Include display name when available (from user_metadata, set during signup)
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.username ||
    undefined

  if (name) {
    payload.name = name
  }

  const encodedSecret = new TextEncoder().encode(secret)

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    // 1-hour expiry — the widget re-initialises on page load, so this is fine
    .setExpirationTime('1h')
    .sign(encodedSecret)

  return NextResponse.json({ token, name: name ?? null })
}
