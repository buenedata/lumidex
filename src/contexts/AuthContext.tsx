'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, userData?: any) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const profileHandledRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error.message)
        } else if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
        }
        if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('Exception in getInitialSession:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Handle user profile creation/update (avoid duplicate calls)
        if (event === 'SIGNED_IN' && session?.user && !profileHandledRef.current.has(session.user.id)) {
          profileHandledRef.current.add(session.user.id)
          try {
            await handleUserProfile(session.user)
          } catch (error) {
            console.error('Error handling user profile:', error)
          }
        }

        // Clear profile handled cache on sign out
        if (event === 'SIGNED_OUT') {
          profileHandledRef.current.clear()
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleUserProfile = useCallback(async (user: User) => {
    try {
      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .eq('id', user.id)
        .single()

      // Prepare update data
      const updateData: any = {
        id: user.id,
        username: user.email!.split('@')[0],
        display_name: user.user_metadata?.full_name || user.email!.split('@')[0],
        updated_at: new Date().toISOString()
      }

      // Only update avatar_url if user has one in metadata AND profile doesn't already have one
      // This prevents overwriting uploaded avatars with OAuth provider avatars
      if (user.user_metadata?.avatar_url && !existingProfile?.avatar_url) {
        updateData.avatar_url = user.user_metadata.avatar_url
      }

      // Use upsert for better performance and atomic operation
      const { error } = await supabase
        .from('profiles')
        .upsert(updateData, {
          onConflict: 'id'
        })

      if (error) {
        console.error('Error upserting user profile:', error.message)
      }
    } catch (error) {
      console.error('Error handling user profile:', error)
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, userData?: any) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: `https://lumidex.app/auth/callback`
        }
      })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `https://lumidex.app/auth/callback`
        }
      })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://lumidex.app/auth/reset-password`
      })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }, [])

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword
  }), [user, session, loading, signUp, signIn, signInWithGoogle, signOut, resetPassword])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}