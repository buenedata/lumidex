'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AuthForm from '@/components/auth/AuthForm'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin')
  }

  const handleSuccess = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Lumidex
          </h1>
          <p className="text-gray-600">
            Your European Pokemon card collection platform
          </p>
        </div>
        
        <AuthForm 
          mode={mode} 
          onToggleMode={toggleMode}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  )
}