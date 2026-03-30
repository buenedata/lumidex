'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { SetSelector } from '../../../components/admin/SetSelector'
import { CardDataImport } from '../../../components/admin/CardDataImport'

export default function CardDataImportPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin/card-data-import')
        return
      }
      if (profile?.role !== 'admin') {
        router.push('/dashboard?error=admin_required')
      }
    }
  }, [user, profile, isLoading, router])

  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSetSelect = (setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
  }


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link href="/admin" className="hover:text-yellow-400 transition-colors">
              🛠️ Admin
            </Link>
            <span>/</span>
            <span className="text-white">Card Data Import</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🎨 Card Data Import
          </h1>
          <p className="text-gray-400 mt-1">
            Choose a set, paste a pkmn.gg set page URL, and bulk-import artist, HP, type, subtype
            and element data for every card in that set.
          </p>
        </div>

        {/* Set selector */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">1. Choose a Set</h2>
          <SetSelector onSetSelect={handleSetSelect} selectedSetId={selectedSetId} showCardStatus />
          {selectedSetName && (
            <p className="mt-3 text-sm text-yellow-400">
              Selected: <span className="font-medium">{selectedSetName}</span>
            </p>
          )}
        </div>

        {/* Import panel — shown only once a set is selected */}
        {selectedSetId ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">2. Import from pkmn.gg</h2>
            <CardDataImport setId={selectedSetId} />
          </div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-8 text-center text-gray-500">
            Select a set above to continue.
          </div>
        )}
      </div>
    </div>
  )
}
