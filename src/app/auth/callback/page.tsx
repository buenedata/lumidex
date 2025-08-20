'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const { user } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Wait for auth to be processed
        setTimeout(async () => {
          if (user) {
            // Check if user has completed setup
            const { data, error } = await supabase
              .from('profiles')
              .select('setup_completed')
              .eq('id', user.id)
              .single()

            if (error) {
              console.error('Error checking setup status:', error)
              // If error, assume setup not completed and redirect to setup
              router.push('/setup')
            } else {
              // Redirect based on setup completion status
              if ((data as any)?.setup_completed) {
                router.push('/dashboard')
              } else {
                router.push('/setup')
              }
            }
          } else {
            // Still waiting for auth
            setTimeout(() => {
              if (!user) {
                router.push('/auth?error=callback_error')
              }
            }, 2000)
          }
          setChecking(false)
        }, 1000)
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/auth?error=callback_error')
        setChecking(false)
      }
    }

    handleAuthCallback()
  }, [router, user])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">
          {checking ? 'Completing sign in...' : 'Redirecting...'}
        </p>
      </div>
    </div>
  )
}