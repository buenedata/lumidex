'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { SetSelector } from '../../../components/admin/SetSelector'
import { CardImageGrid, type CardGridItem } from '../../../components/admin/CardImageGrid'
import { CardImageUploadModal } from '../../../components/admin/CardImageUploadModal'
import { BulkImageImport } from '../../../components/admin/BulkImageImport'
import { RecompressImages } from '../../../components/admin/RecompressImages'

export default function CardImagesPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<CardGridItem | null>(null)
  const [cardList, setCardList] = useState<CardGridItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [gridRefreshKey, setGridRefreshKey] = useState(0)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin/card-images')
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
    setSelectedCard(null)
    setCardList([])
  }

  const handleCardSelect = (card: CardGridItem) => {
    setSelectedCard(card)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_cardId: string, _imageUrl: string) => {
    // Increment refresh key so the grid re-fetches with the updated image
    setGridRefreshKey((k) => k + 1)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    // Keep selectedCard so the grid stays highlighted until the user picks another
  }

  const handleNextCard = () => {
    if (!selectedCard || cardList.length === 0) return
    const currentIndex = cardList.findIndex((c) => c.id === selectedCard.id)
    const nextCard = cardList[currentIndex + 1]
    if (nextCard) {
      setSelectedCard(nextCard)
      // modal stays open, reset happens inside the modal via reset()
    }
  }

  const currentCardIndex = selectedCard ? cardList.findIndex((c) => c.id === selectedCard.id) : -1
  const hasNextCard = currentCardIndex >= 0 && currentCardIndex < cardList.length - 1

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link href="/admin" className="hover:text-yellow-400 transition-colors">
              🛠️ Admin
            </Link>
            <span>/</span>
            <span className="text-white">Card Image Upload</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🖼️ Card Image Upload
          </h1>
          <p className="text-gray-400 mt-1">
            Choose a set, browse its cards, and click any card to upload or replace its image.
          </p>
        </div>

        {/* Step 1 — Choose a set */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-200">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold mr-2">
              1
            </span>
            Choose a set
          </h2>
          <SetSelector
            selectedSetId={selectedSetId}
            onSetSelect={handleSetSelect}
            showImageStatus
          />
        </section>

        {/* Step 2 — Browse cards */}
        {selectedSetId && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold mr-2">
                2
              </span>
              Select a card
              {selectedSetName && (
                <span className="ml-2 text-gray-400 font-normal text-base">
                  — {selectedSetName}
                </span>
              )}
            </h2>

            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <CardImageGrid
                setId={selectedSetId}
                onCardSelect={handleCardSelect}
                onCardsLoaded={setCardList}
                selectedCardId={selectedCard?.id}
                refreshKey={gridRefreshKey}
              />
            </div>

            <p className="mt-2 text-gray-500 text-xs">
              💡 Grey = no image stored. Click any card to open the upload dialog.
            </p>
          </section>
        )}

        {/* Step 3 — Bulk import */}
        {selectedSetId && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold mr-2">
                3
              </span>
              Bulk import from pkmn.gg
              <span className="ml-2 text-gray-400 font-normal text-base">
                — paste a set or collection URL to import all card images at once
              </span>
            </h2>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <BulkImageImport
                setId={selectedSetId}
                onComplete={() => setGridRefreshKey((k) => k + 1)}
              />
            </div>
          </section>
        )}

        {/* Upload modal */}
        <CardImageUploadModal
          card={selectedCard}
          isOpen={modalOpen}
          onClose={handleModalClose}
          onUploadSuccess={handleUploadSuccess}
          onNextCard={handleNextCard}
          hasNextCard={hasNextCard}
        />

        {/* Step 4 — Recompress existing images (always visible) */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-200">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold mr-2">
              4
            </span>
            Recompress existing storage
            <span className="ml-2 text-gray-400 font-normal text-base">
              — shrink all images already in a bucket to WebP
            </span>
          </h2>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <RecompressImages defaultBucket="card-images" />
          </div>
        </section>

        {/* Instructions (collapsed when a set is active) */}
        {!selectedSetId && (
          <div className="mt-6 p-5 bg-gray-900 border border-gray-700 rounded-xl">
            <h3 className="font-semibold text-yellow-400 mb-2">💡 How it works</h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-1 text-sm">
              <li>Pick the set you want to work on from the list above</li>
              <li>The card grid shows all cards — grey tiles have no image yet</li>
              <li>Click any card to open the upload dialog</li>
              <li>
                Drag an image from{' '}
                <strong className="text-yellow-400">TCGCollector</strong>
                {' '}or{' '}
                <strong className="text-yellow-400">pkmn.gg</strong>,
                paste an image URL, or browse for a local file
              </li>
              <li>The image is fetched server-side, saved to Supabase Storage, and the card record is updated</li>
            </ol>
          </div>
        )}

      </div>
    </div>
  )
}
