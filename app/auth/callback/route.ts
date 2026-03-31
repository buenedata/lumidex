import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

    const response = NextResponse.redirect(new URL(next, origin))

    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // After a successful OAuth exchange, ensure the user has a profile row.
      // Email/password users get a row via a DB trigger; OAuth users (Discord,
      // Google) may arrive here without one on their very first sign-in.
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data: existingProfile } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()

          if (!existingProfile) {
            // New user (email/password or OAuth) — derive a username.
            // Email/password signup stores the chosen username in user_metadata.username.
            // Discord supplies: user_metadata.custom_claims.global_name, user_metadata.user_name
            // Google supplies:  user_metadata.full_name, user_metadata.name
            const meta = user.user_metadata ?? {}

            const rawName: string =
              meta.username ||                    // email/password signup (signUpWithEmail stores this)
              meta.custom_claims?.global_name ||  // Discord display name
              meta.user_name ||                   // Discord username handle
              meta.preferred_username ||          // generic OAuth field
              meta.full_name ||                   // Google / generic
              meta.name ||                        // Google fallback
              `user_${user.id.slice(0, 8)}`

            // Sanitise to alphanumeric + underscores, max 30 chars
            const username = rawName
              .replace(/[^a-zA-Z0-9_]/g, '_')
              .replace(/_+/g, '_')
              .slice(0, 30)

            const avatarUrl: string | null = meta.avatar_url || null

            await supabaseAdmin
              .from('users')
              .insert([{ id: user.id, username, email: user.email ?? null, avatar_url: avatarUrl }])
            // Errors are intentionally swallowed here — if the insert fails
            // (e.g. duplicate from a race condition) we still let the user in.
          }
        }
      } catch (_profileErr) {
        // Non-fatal: profile creation failure should not block login
        console.error('⚠️ OAuth profile bootstrap error:', _profileErr)
      }

      return response
    }

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)
    )
  }

  return NextResponse.redirect(new URL('/login?error=no_code', origin))
}
