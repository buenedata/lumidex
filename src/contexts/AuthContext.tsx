'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
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
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Simple, reliable auth initialization
    const initializeAuth = async () => {
      try {
        // Set a maximum 5 second timeout for initialization
        timeoutId = setTimeout(() => {
          if (mounted && !initialized) {
            console.warn('Auth initialization timeout - proceeding without session')
            setLoading(false)
            setInitialized(true)
          }
        }, 5000)

        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (mounted) {
          clearTimeout(timeoutId)
          
          if (error) {
            console.error('Auth session error:', error.message)
          }
          
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          clearTimeout(timeoutId)
          setSession(null)
          setUser(null)
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('Auth state change:', event, session?.user?.id)
        
        setSession(session)
        setUser(session?.user ?? null)
        
        // Only set loading to false after initial auth check
        if (initialized) {
          setLoading(false)
        }
        
        // Handle profile creation for new users (simplified)
        if (event === 'SIGNED_IN' && session?.user) {
          // Fire and forget profile creation - don't block auth flow
          handleUserProfile(session.user).catch(error => {
            console.error('Profile creation error (non-blocking):', error)
          })
        }
      }
    )

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [initialized])

  // Simplified profile handling - no blocking, no complex retries
  const handleUserProfile = async (user: User) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: user.email!.split('@')[0],
          display_name: user.user_metadata?.full_name || user.email!.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

      if (error) {
        console.error('Profile upsert error:', error.message)
      }
    } catch (error) {
      console.error('Profile handling error:', error)
    }
  }

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