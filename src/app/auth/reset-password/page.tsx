'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    setMounted(true)
    
    // Check if we have the required tokens from the URL
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    
    if (!accessToken || !refreshToken) {
      setError('Invalid or expired reset link. Please request a new password reset.')
    }
  }, [searchParams])

  const validatePassword = (password: string) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
    
    return requirements
  }

  const passwordRequirements = validatePassword(password)
  const isPasswordValid = Object.values(passwordRequirements).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isPasswordValid) {
      setError('Please ensure your password meets all requirements')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return null
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
          <div className="flex items-center justify-center mb-4">
            <div className="text-4xl mr-3">🔐</div>
            <h1 className="text-3xl font-bold text-white">
              Reset Password
            </h1>
          </div>
          <p className="text-gray-400">
            Enter your new password below
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="card-container">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-4 mb-6">
                <p className="text-green-400 text-sm">Password updated successfully!</p>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                You'll be redirected to your dashboard in a few seconds...
              </p>
              <Link href="/dashboard" className="btn-gaming">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-4 animate-slide-up">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input-gaming w-full pr-10"
                    placeholder="Enter your new password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Password Requirements */}
                {password && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-400">Password requirements:</p>
                    <div className="grid grid-cols-1 gap-1 text-xs">
                      <div className={`flex items-center ${passwordRequirements.length ? 'text-green-400' : 'text-gray-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${passwordRequirements.length ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                        At least 8 characters
                      </div>
                      <div className={`flex items-center ${passwordRequirements.uppercase ? 'text-green-400' : 'text-gray-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${passwordRequirements.uppercase ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                        One uppercase letter
                      </div>
                      <div className={`flex items-center ${passwordRequirements.lowercase ? 'text-green-400' : 'text-gray-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${passwordRequirements.lowercase ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                        One lowercase letter
                      </div>
                      <div className={`flex items-center ${passwordRequirements.number ? 'text-green-400' : 'text-gray-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${passwordRequirements.number ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                        One number
                      </div>
                      <div className={`flex items-center ${passwordRequirements.special ? 'text-green-400' : 'text-gray-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${passwordRequirements.special ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                        One special character
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="input-gaming w-full pr-10"
                    placeholder="Confirm your new password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-2 text-xs text-red-400">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid || password !== confirmPassword}
                className="btn-gaming w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="spinner mr-2"></div>
                    Updating Password...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Update Password
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Remember your password?{' '}
              <Link
                href="/auth/signin"
                className="text-pokemon-gold hover:text-pokemon-gold-hover font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}