'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, ArrowLeft, Check } from 'lucide-react'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { user, signUp } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  const validatePassword = (password: string) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
    }
    return requirements
  }

  const passwordRequirements = validatePassword(password)
  const isPasswordValid = Object.values(passwordRequirements).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted!')
    setLoading(true)
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (!isPasswordValid) {
      setError('Password does not meet requirements')
      setLoading(false)
      return
    }

    try {
      const { error } = await signUp(email, password)
      if (error) {
        console.log('Signup error:', error.message)
        setError(error.message)
      } else {
        console.log('Signup successful!')
        setMessage('Check your email for a confirmation link!')
      }
    } catch (err) {
      console.log('Unexpected error:', err)
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
            Create your trainer account
          </p>
        </div>

        {/* Sign Up Form */}
        <div className="card-container">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-4 animate-slide-up">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {message && (
              <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-4 animate-slide-up">
                <p className="text-green-400 text-sm">{message}</p>
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
                  placeholder="Create a strong password"
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

              {/* Password Requirements */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className={`flex items-center text-xs ${passwordRequirements.length ? 'text-green-400' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 mr-2 ${passwordRequirements.length ? 'text-green-400' : 'text-gray-500'}`} />
                    At least 8 characters
                  </div>
                  <div className={`flex items-center text-xs ${passwordRequirements.uppercase ? 'text-green-400' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 mr-2 ${passwordRequirements.uppercase ? 'text-green-400' : 'text-gray-500'}`} />
                    One uppercase letter
                  </div>
                  <div className={`flex items-center text-xs ${passwordRequirements.lowercase ? 'text-green-400' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 mr-2 ${passwordRequirements.lowercase ? 'text-green-400' : 'text-gray-500'}`} />
                    One lowercase letter
                  </div>
                  <div className={`flex items-center text-xs ${passwordRequirements.number ? 'text-green-400' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 mr-2 ${passwordRequirements.number ? 'text-green-400' : 'text-gray-500'}`} />
                    One number
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input-gaming w-full pr-10"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                required
                className="w-4 h-4 text-pokemon-gold bg-pkmn-surface border-gray-600 rounded focus:ring-pokemon-gold focus:ring-2 mt-1"
                disabled={loading}
              />
              <label htmlFor="terms" className="ml-2 text-sm text-gray-400">
                I agree to the{' '}
                <Link href="/terms" className="text-pokemon-gold hover:text-pokemon-gold-hover">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-pokemon-gold hover:text-pokemon-gold-hover">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || password !== confirmPassword}
              className="btn-gaming w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="spinner mr-2"></div>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link
                href="/auth/signin"
                className="text-pokemon-gold hover:text-pokemon-gold-hover font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-4">Join thousands of European collectors</p>
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
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
            <div className="flex items-center">
              <div className="w-2 h-2 bg-pokemon-gold rounded-full mr-2"></div>
              Achievement System
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}