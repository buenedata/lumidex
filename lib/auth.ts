import { supabase, supabaseAdmin } from './supabase'
import { type User } from '@supabase/supabase-js'

export async function signInWithGoogle() {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return { data: null, error: { message: 'Google OAuth is not available in server-side environment.' } }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })
    
    if (error) {
      // Provide more user-friendly error messages
      if (error.message.includes('OAuth')) {
        return { data, error: { ...error, message: 'Google sign-in is not properly configured. Please contact support.' } }
      }
    }
    
    return { data, error }
  } catch (err: any) {
    return { data: null, error: { message: 'Failed to initiate Google sign-in. Please try again.' } }
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      // Provide more user-friendly error messages
      if (error.message.includes('Invalid login credentials')) {
        return { data, error: { ...error, message: 'Invalid email or password. Please try again.' } }
      }
      if (error.message.includes('Email not confirmed')) {
        return { data, error: { ...error, message: 'Please check your email and click the confirmation link before signing in.' } }
      }
    }
    
    return { data, error }
  } catch (err: any) {
    return { data: null, error: { message: 'Network error. Please check your connection and try again.' } }
  }
}

export async function signUpWithEmail(email: string, password: string, username: string) {
  try {
    // Basic password validation
    if (password.length < 6) {
      return {
        data: null,
        error: { message: 'Password must be at least 6 characters long.' }
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    })
    
    if (error) {
      // Provide more user-friendly error messages
      if (error.message.includes('User already registered')) {
        return { data, error: { ...error, message: 'An account with this email already exists. Try signing in instead.' } }
      }
      if (error.message.includes('Password should be at least 6 characters')) {
        return { data, error: { ...error, message: 'Password must be at least 6 characters long.' } }
      }
    }
    
    // Profile will be created automatically via database trigger
    // when the user confirms their email address
    if (data.user && !error) {
      console.log('✅ Signup successful - profile will be created on email confirmation')
    }
    
    return { data, error }
  } catch (err: any) {
    return { data: null, error: { message: 'Network error. Please check your connection and try again.' } }
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  
  return { data, error }
}