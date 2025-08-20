'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [mounted, setMounted] = useState(false)
  
  const { resetPassword } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a password reset link!')
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
          <Link href="/auth/signin" className="inline-flex items-center text-pokemon-gold hover:text-pokemon-gold-hover transition-colors mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Link>
          
          <div className="flex items-center justify-center mb-4">
            <div className="text-4xl mr-3">🃏</div>
            <h1 className="text-3xl font-bold text-white">
              Reset Password
            </h1>
          </div>
          <p className="text-gray-400">
            Enter your email to receive a password reset link
          </p>
        </div>

        {/* Reset Password Form */}
        <div className="card-container">
          {message ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
              <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-4 mb-6">
                <p className="text-green-400 text-sm">{message}</p>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                If an account with that email exists, you'll receive a password reset link shortly.
              </p>
              <Link href="/auth/signin" className="btn-gaming">
                Back to Sign In
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
                <p className="mt-2 text-xs text-gray-500">
                  We'll send a password reset link to this email address.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="btn-gaming w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="spinner mr-2"></div>
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Reset Link
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

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-4">Need help?</p>
          <div className="space-y-2 text-xs text-gray-600">
            <p>• Check your spam folder if you don't see the email</p>
            <p>• Reset links expire after 1 hour for security</p>
            <p>• Contact support if you continue having issues</p>
          </div>
        </div>
      </div>
    </div>
  )
}