/**
 * Admin Auth Utilities
 *
 * Server-only helpers used by admin API routes and Server Actions.
 * Requires the caller to be authenticated AND have role = 'admin'
 * in the users table.
 */

import { createSupabaseServerClient } from './supabaseServer'
import { supabaseAdmin } from './supabase'
import type { User } from '@supabase/supabase-js'

/**
 * Verify that the incoming request comes from an authenticated admin user.
 *
 * - Reads the auth session from cookies via the server-side Supabase client.
 * - Checks the `role` column in the `users` table using the service-role
 *   client (bypasses RLS so the lookup always succeeds).
 * - Throws an `Error` if the user is not authenticated or is not an admin;
 *   callers should catch this and return a 401 response.
 * - Returns the Supabase `User` object on success (useful when the caller
 *   needs the user id, e.g. for audit logging).
 */
export async function requireAdmin(): Promise<User> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: not authenticated')
  }

  // Use the service-role client so this read always succeeds regardless of RLS policies
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('Unauthorized: user profile not found')
  }

  if (profile.role !== 'admin') {
    throw new Error('Unauthorized: admin access required')
  }

  return user
}

/**
 * Returns the Supabase service-role client.
 * Convenience wrapper so callers don't need to import from two files.
 */
export function getAdminSupabaseClient() {
  return supabaseAdmin
}
