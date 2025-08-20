'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({ 
  children, 
  redirectTo = '/auth/signin' 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      console.log('ProtectedRoute: Redirecting unauthenticated user to', redirectTo)
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show nothing while redirecting unauthenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  // User is authenticated, render the protected content
  return <>{children}</>
}