// App initialization hook - manages auth state and service integration

import { useEffect, useState } from 'react'
import { useAppStore, initializeStoreFromUser } from '../state/app-store'
import { supabase } from '../supabase'
import { initializeServices, getUserService } from '../core/service-registry'

/**
 * Custom hook for app initialization
 * Replaces the complex context provider setup
 */
export function useAppInitialization() {
  const [isInitialized, setIsInitialized] = useState(false)
  const { 
    user, 
    setUser, 
    setSession, 
    setLoading, 
    setError,
    setProfileData 
  } = useAppStore()

  useEffect(() => {
    let mounted = true

    const initializeApp = async () => {
      try {
        setLoading(true)

        // Initialize services
        await initializeServices()

        // Get initial auth session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth session error:', error.message)
          setError(error.message)
        } else {
          setSession(session)
          const currentUser = session?.user
          
          if (currentUser) {
            // Initialize user in store
            setUser({
              id: currentUser.id,
              username: currentUser.email?.split('@')[0] || 'user',
              display_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
              avatar_url: currentUser.user_metadata?.avatar_url,
              privacy_level: 'public',
              show_collection_value: true,
              preferred_currency: 'EUR',
              preferred_language: 'en',
              created_at: currentUser.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

            // Load full profile data
            try {
              const userService = getUserService()
              const profileResult = await userService.getUserProfile(currentUser.id)
              
              if (profileResult.success && profileResult.data) {
                setProfileData(profileResult.data)
                initializeStoreFromUser(profileResult.data.user)
              }
            } catch (profileError) {
              console.warn('Failed to load full profile:', profileError)
              // Continue with basic user data
            }
          }
        }

        if (mounted) {
          setIsInitialized(true)
          setLoading(false)
        }
      } catch (error) {
        console.error('App initialization error:', error)
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to initialize app')
          setLoading(false)
        }
      }
    }

    initializeApp()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('Auth state change:', event, session?.user?.id)
        
        setSession(session)
        const currentUser = session?.user

        if (event === 'SIGNED_IN' && currentUser) {
          // User signed in
          setUser({
            id: currentUser.id,
            username: currentUser.email?.split('@')[0] || 'user',
            display_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
            avatar_url: currentUser.user_metadata?.avatar_url,
            privacy_level: 'public',
            show_collection_value: true,
            preferred_currency: 'EUR',
            preferred_language: 'en',
            created_at: currentUser.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

          // Load profile data
          try {
            const userService = getUserService()
            const profileResult = await userService.getUserProfile(currentUser.id)
            
            if (profileResult.success && profileResult.data) {
              setProfileData(profileResult.data)
              initializeStoreFromUser(profileResult.data.user)
            }
          } catch (error) {
            console.warn('Failed to load profile on sign in:', error)
          }
        } else if (event === 'SIGNED_OUT') {
          // User signed out
          setUser(null)
          setProfileData(null)
          setError(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setUser, setSession, setLoading, setError, setProfileData])

  return {
    isInitialized,
    user,
    loading: useAppStore(state => state.loading),
    error: useAppStore(state => state.error)
  }
}

/**
 * Hook for auth operations
 */
export function useAuthOperations() {
  const { setLoading, setError, addToast } = useAppStore()

  const signUp = async (email: string, password: string, userData?: any) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        setError(error.message)
        addToast({
          type: 'error',
          title: 'Sign Up Failed',
          message: error.message
        })
        return { error }
      }

      addToast({
        type: 'success',
        title: 'Account Created',
        message: 'Please check your email to verify your account'
      })

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(message)
      addToast({
        type: 'error',
        title: 'Sign Up Failed',
        message
      })
      return { error: { message } }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setError(error.message)
        addToast({
          type: 'error',
          title: 'Sign In Failed',
          message: error.message
        })
        return { error }
      }

      addToast({
        type: 'success',
        title: 'Welcome Back',
        message: 'Successfully signed in'
      })

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(message)
      addToast({
        type: 'error',
        title: 'Sign In Failed',
        message
      })
      return { error: { message } }
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        setError(error.message)
        addToast({
          type: 'error',
          title: 'Google Sign In Failed',
          message: error.message
        })
        return { error }
      }

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(message)
      addToast({
        type: 'error',
        title: 'Google Sign In Failed',
        message
      })
      return { error: { message } }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setError(error.message)
        addToast({
          type: 'error',
          title: 'Sign Out Failed',
          message: error.message
        })
        return { error }
      }

      addToast({
        type: 'success',
        title: 'Signed Out',
        message: 'Successfully signed out'
      })

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(message)
      addToast({
        type: 'error',
        title: 'Sign Out Failed',
        message
      })
      return { error: { message } }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (error) {
        setError(error.message)
        addToast({
          type: 'error',
          title: 'Password Reset Failed',
          message: error.message
        })
        return { error }
      }

      addToast({
        type: 'success',
        title: 'Password Reset Email Sent',
        message: 'Check your email for password reset instructions'
      })

      return { error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(message)
      addToast({
        type: 'error',
        title: 'Password Reset Failed',
        message
      })
      return { error: { message } }
    } finally {
      setLoading(false)
    }
  }

  return {
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword
  }
}