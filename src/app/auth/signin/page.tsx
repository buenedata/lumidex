'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user, signIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  useEffect(() => {
    if (user && !loading) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      } else {
        router.push(redirectTo)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-pkmn-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>⚡</div>
        <div className="absolute top-20 right-20 text-3xl animate-bounce" style={{ animationDelay: '0.5s' }}>🔥</div>
        <div className="absolute bottom-20 left-20 text-4xl animate-bounce" style={{ animationDelay: '1s' }}>💧</div>
        <div className="absolute bottom-10 right-10 text-3xl animate-bounce" style={{ animationDelay: '1.5s' }}>🌿</div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-pokemon-gold hover:text-pokemon-gold-hover transition-colors mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <div className="flex items-center justify-center mb-4">
            <div className="text-4xl mr-3">🃏</div>
            <h1 className="text-3xl font-bold text-white">
              Pokemon TCG EU
            </h1>
          </div>
          <p className="text-gray-400">
            Sign in to your collection
          </p>
        </div>

        {/* Sign In Form */}
        <div className="card-container">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-4 animate-slide-up">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-gaming w-full"
                placeholder="trainer@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-gaming w-full pr-10"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="w-4 h-4 text-pokemon-gold bg-pkmn-surface border-gray-600 rounded focus:ring-pokemon-gold focus:ring-2"
                />
                <label htmlFor="remember-me" className="ml-2 text-sm text-gray-400">
                  Remember me
                </label>
              </div>

              <Link
                href="/auth/forgot-password"
                className="text-sm text-pokemon-gold hover:text-pokemon-gold-hover transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gaming w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="spinner mr-2"></div>
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Don't have an account?{' '}
              <Link
                href="/auth/signup"
                className="text-pokemon-gold hover:text-pokemon-gold-hover font-medium transition-colors"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-4">Join thousands of European collectors</p>
          <div className="flex justify-center space-x-6 text-xs text-gray-600">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-pokemon-gold rounded-full mr-2"></div>
              CardMarket Pricing
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-pokemon-gold rounded-full mr-2"></div>
              Multi-Currency
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-pokemon-gold rounded-full mr-2"></div>
              Safe Trading
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}