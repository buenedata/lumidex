'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { SetImageGrid, type SetGridItem } from '../../../components/admin/SetImageGrid'
import { SetImageUploadModal } from '../../../components/admin/SetImageUploadModal'

export default function SetImagesPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [selectedSet, setSelectedSet] = useState<SetGridItem | null>(null)
  const [setList, setSetList] = useState<SetGridItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [gridRefreshKey, setGridRefreshKey] = useState(0)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin/set-images')
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
  const handleSetSelect = (set: SetGridItem) => {
    setSelectedSet(set)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_setId: string, logoUrl: string) => {
    // Patch the selected set's logo_url in place so the grid thumbnail updates
    // without a full refetch, then trigger a full refresh to sync all rows.
    setSelectedSet((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev))
    setGridRefreshKey((k) => k + 1)
  }

  const handleModalClose = () => {
    setModalOpen(false)
  }

  const handleNextSet = () => {
    if (!selectedSet || setList.length === 0) return
    const currentIndex = setList.findIndex((s) => s.id === selectedSet.id)
    const nextSet = setList[currentIndex + 1]
    if (nextSet) {
      setSelectedSet(nextSet)
      // modal stays open; reset happens inside the modal
    }
  }

  const currentSetIndex = selectedSet ? setList.findIndex((s) => s.id === selectedSet.id) : -1
  const hasNextSet = currentSetIndex >= 0 && currentSetIndex < setList.length - 1

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-yellow-400 transition-colors">
            ← Admin
          </Link>
          <span>/</span>
          <span className="text-white">Set Image Upload</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🗂️ Set Image Upload
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Click a set to open the upload modal, then drag the logo from{' '}
            <a
              href="https://www.pkmn.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:underline"
            >
              pkmn.gg
            </a>{' '}
            directly into the drop zone.
          </p>
        </div>

        {/* Set list */}
        <SetImageGrid
          onSetSelect={handleSetSelect}
          onSetsLoaded={setSetList}
          selectedSetId={selectedSet?.id ?? null}
          refreshKey={gridRefreshKey}
        />
      </div>

      {/* Upload modal */}
      <SetImageUploadModal
        set={selectedSet}
        isOpen={modalOpen}
        onClose={handleModalClose}
        onUploadSuccess={handleUploadSuccess}
        onNextSet={handleNextSet}
        hasNextSet={hasNextSet}
      />
    </div>
  )
}
