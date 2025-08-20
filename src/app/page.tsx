'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Footer from '@/components/ui/Footer'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const handleAuthRedirect = async () => {
      if (loading) return

      if (user) {
        // Check if user has completed setup
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('setup_completed')
            .eq('id', user.id)
            .single()

          if (error) {
            console.error('Error checking setup status:', error)
            // If error, redirect to setup to be safe
            router.push('/setup')
          } else {
            // Redirect based on setup completion status
            if ((data as any)?.setup_completed) {
              router.push('/dashboard')
            } else {
              router.push('/setup')
            }
          }
        } catch (error) {
          console.error('Error in auth redirect:', error)
          router.push('/setup')
        }
      }
    }

    handleAuthRedirect()
  }, [user, loading, router])

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  // Show home page for non-authenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-bold text-pokemon-gold mb-8">
              Lumidex
            </h1>
            <p className="text-white mb-8">
              Welcome to Lumidex - Your Pokemon TCG Collection Tracker
            </p>
            <div className="space-y-4">
              <Link href="/auth/signin" className="btn-gaming block">
                Sign In
              </Link>
              <Link href="/auth/signup" className="btn-secondary block">
                Sign Up
              </Link>
              <Link href="/cards" className="btn-outline block">
                Browse Cards
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // Show loading while redirecting authenticated users
  return (
    <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="text-white mt-4">Redirecting...</p>
      </div>
    </div>
  )
}