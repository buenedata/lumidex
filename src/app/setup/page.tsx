'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import SetupWizard from '@/components/setup/SetupWizard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function SetupPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [setupCompleted, setSetupCompleted] = useState(false)

  useEffect(() => {
    const checkSetupStatus = async () => {
      if (!user || authLoading) return

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('setup_completed')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error checking setup status:', error)
          // If there's an error, assume setup is not completed
          setSetupCompleted(false)
        } else {
          setSetupCompleted((data as any)?.setup_completed || false)
        }
      } catch (error) {
        console.error('Error checking setup status:', error)
        setSetupCompleted(false)
      } finally {
        setLoading(false)
      }
    }

    checkSetupStatus()
  }, [user, authLoading])

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
    }
  }, [user, authLoading, router])

  // Redirect if setup is already completed
  useEffect(() => {
    if (!loading && setupCompleted) {
      router.push('/dashboard')
    }
  }, [loading, setupCompleted, router])

  const handleSetupComplete = () => {
    router.push('/dashboard')
  }

  const handleSetupSkip = () => {
    router.push('/dashboard')
  }

  // Show loading while checking auth or setup status
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render anything if user is not authenticated (will redirect)
  if (!user) {
    return null
  }

  // Don't render anything if setup is completed (will redirect)
  if (setupCompleted) {
    return null
  }

  return (
    <SetupWizard
      onComplete={handleSetupComplete}
      onSkip={handleSetupSkip}
    />
  )
}