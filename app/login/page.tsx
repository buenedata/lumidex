'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmail, signInWithGoogle, signUpWithEmail, getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    getCurrentUser().then(({ user }) => {
      if (user) {
        router.push('/dashboard')
      }
    })
  }, [router])

  const resetMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!email || !password || (!isLogin && !username)) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    resetMessages()

    try {
      if (isLogin) {
        const { data, error } = await signInWithEmail(email, password)
        if (error) throw error

        if (data && data.user) {
          setSuccess('Login successful! Redirecting…')
          setTimeout(() => {
            router.push('/dashboard')
          }, 1000)
        }
      } else {
        const { data, error } = await signUpWithEmail(email, password, username)
        if (error) throw error

        if (data && data.user) {
          setSuccess('Account created! Please check your email to confirm your account.')
          // Clear form
          setEmail('')
          setPassword('')
          setUsername('')
        }
      }
    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setLoading(true)
    resetMessages()

    try {
      const { data, error } = await signInWithGoogle()
      if (error) throw error
      // Note: Google OAuth will redirect automatically
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-subtle rounded-2xl p-8 flex flex-col gap-6 shadow-2xl">

        {/* ── Branding ─────────────────────────────────────────────── */}
        <div className="text-center">
          <p
            className="text-2xl font-bold gradient-text tracking-widest mb-2"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            ✦ LUMIDEX
          </p>
          <h1 className="text-base font-semibold text-primary">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p className="text-sm text-muted mt-1">Track your Pokémon card collection</p>
        </div>

        {/* ── Tab Toggle ───────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-elevated rounded-xl">
          <button
            type="button"
            onClick={() => { setIsLogin(true); resetMessages() }}
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-150',
              isLogin
                ? 'bg-surface text-primary shadow-sm'
                : 'text-muted hover:text-secondary'
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); resetMessages() }}
            className={cn(
              'flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-150',
              !isLogin
                ? 'bg-surface text-primary shadow-sm'
                : 'text-muted hover:text-secondary'
            )}
          >
            Sign Up
          </button>
        </div>

        {/* ── Feedback Messages ────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {error}
          </div>
        )}

        {success && (
          <div className="px-4 py-3 rounded-xl bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.3)] text-price text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────────── */}
        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
          {!isLogin && (
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required={!isLogin}
              disabled={loading}
            />
          )}

          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-1"
            disabled={loading}
            loading={loading}
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
          <span className="text-xs text-muted shrink-0">or continue with</span>
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
        </div>

        {/* ── Google Button ─────────────────────────────────────────── */}
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          onClick={handleGoogleAuth}
          disabled={loading}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>
      </div>
    </div>
  )
}
