'use client'

import Link from 'next/link'
import { VariantManager } from '@/components/admin/VariantManager'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Variant, VariantSuggestion } from '@/types'

export default function AdminVariantsPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()
  const [variants, setVariants] = useState<Variant[]>([])
  const [suggestions, setSuggestions] = useState<VariantSuggestion[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin/variants')
        return
      }
      
      if (profile?.role !== 'admin') {
        router.push('/dashboard?error=admin_required')
        return
      }
    }
  }, [user, profile, isLoading, router])

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      fetchAdminData()
    }
  // Depend on stable primitives, not object references — Supabase fires
  // TOKEN_REFRESHED on every tab focus which creates a new user object but
  // does not change the user's identity or role, so we must not re-fetch here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role])

  const fetchAdminData = async () => {
    try {
      setDataLoading(true)
      setError(null)

      // Fetch variants
      const variantsResponse = await fetch('/api/variants')
      if (!variantsResponse.ok) {
        throw new Error('Failed to fetch variants')
      }
      const variantsData = await variantsResponse.json()
      setVariants(Array.isArray(variantsData) ? variantsData : [])

      // Fetch suggestions
      const suggestionsResponse = await fetch('/api/variant-suggestions')
      if (!suggestionsResponse.ok) {
        throw new Error('Failed to fetch suggestions')
      }
      const suggestionsData = await suggestionsResponse.json()
      setSuggestions(Array.isArray(suggestionsData) ? suggestionsData : [])

    } catch (err) {
      console.error('Error fetching admin data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setDataLoading(false)
    }
  }

  // Show loading while checking auth
  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Show error if data loading failed
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button 
            onClick={fetchAdminData}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show loading while fetching data
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading admin data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link href="/admin" className="hover:text-yellow-400 transition-colors">🛠️ Admin</Link>
            <span>/</span>
            <span className="text-white">Variant Management</span>
          </div>

          <h1 className="text-4xl font-bold text-white mb-2">
            Variant Management Panel
          </h1>
          <p className="text-gray-400">
            Manage card variants and review user suggestions
          </p>
          
        </div>

        {/* Main Component */}
        <VariantManager
          initialVariants={variants}
          initialSuggestions={suggestions}
          onVariantsChange={setVariants}
          onSuggestionsChange={setSuggestions}
        />
      </div>
    </div>
  )
}