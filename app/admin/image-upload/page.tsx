'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

// Card Images imports
import { SetSelector } from '../../../components/admin/SetSelector'
import { CardImageGrid, type CardGridItem } from '../../../components/admin/CardImageGrid'
import { CardImageUploadModal } from '../../../components/admin/CardImageUploadModal'
import { BulkImageImport } from '../../../components/admin/BulkImageImport'
import { RecompressImages } from '../../../components/admin/RecompressImages'

// Set Images imports
import { SetImageGrid, type SetGridItem } from '../../../components/admin/SetImageGrid'
import { SetImageUploadModal } from '../../../components/admin/SetImageUploadModal'

// Set Symbols imports
import { SetSymbolGrid, type SetSymbolGridItem } from '../../../components/admin/SetSymbolGrid'
import { SetSymbolUploadModal } from '../../../components/admin/SetSymbolUploadModal'

// Product Images imports
import { ProductImageGrid, type ProductGridItem } from '../../../components/admin/ProductImageGrid'
import { ProductImageUploadModal } from '../../../components/admin/ProductImageUploadModal'

// ─────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────
const TABS = [
  { id: 'card-images',     label: 'Card Images',     icon: '🖼️' },
  { id: 'set-images',      label: 'Set Images',      icon: '🗂️' },
  { id: 'set-symbols',     label: 'Set Symbols',     icon: '🔷' },
  { id: 'product-images',  label: 'Product Images',  icon: '📦' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─────────────────────────────────────────────
// Card Images Tab
// ─────────────────────────────────────────────
function CardImagesTab() {
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<CardGridItem | null>(null)
  const [cardList, setCardList] = useState<CardGridItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [gridRefreshKey, setGridRefreshKey] = useState(0)

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
    setGridRefreshKey((k) => k + 1)
  }

  const handleModalClose = () => setModalOpen(false)

  const handleNextCard = () => {
    if (!selectedCard || cardList.length === 0) return
    const currentIndex = cardList.findIndex((c) => c.id === selectedCard.id)
    const nextCard = cardList[currentIndex + 1]
    if (nextCard) setSelectedCard(nextCard)
  }

  const currentCardIndex = selectedCard ? cardList.findIndex((c) => c.id === selectedCard.id) : -1
  const hasNextCard = currentCardIndex >= 0 && currentCardIndex < cardList.length - 1

  return (
    <div>
      <p className="text-gray-400 text-sm mb-6">
        Choose a set, browse its cards, and click any card to upload or replace its image.
      </p>

      {/* Step 1 — Choose a set */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 text-gray-200 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold">1</span>
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
          <h2 className="text-base font-semibold mb-3 text-gray-200 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold">2</span>
            Select a card
            {selectedSetName && (
              <span className="text-gray-400 font-normal text-sm">— {selectedSetName}</span>
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
          <h2 className="text-base font-semibold mb-3 text-gray-200 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold">3</span>
            Bulk import from pkmn.gg
            <span className="text-gray-400 font-normal text-sm">— paste a set or collection URL to import all card images at once</span>
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

      {/* Step 4 — Recompress */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 text-gray-200 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold">4</span>
          Recompress existing storage
          <span className="text-gray-400 font-normal text-sm">— shrink all images already in a bucket to WebP</span>
        </h2>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <RecompressImages defaultBucket="card-images" />
        </div>
      </section>

      {/* How it works (only when no set selected) */}
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
  )
}

// ─────────────────────────────────────────────
// Set Images Tab
// ─────────────────────────────────────────────
function SetImagesTab() {
  const [selectedSet, setSelectedSet] = useState<SetGridItem | null>(null)
  const [setList, setSetList] = useState<SetGridItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [gridRefreshKey, setGridRefreshKey] = useState(0)

  const handleSetSelect = (set: SetGridItem) => {
    setSelectedSet(set)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_setId: string, logoUrl: string) => {
    setSelectedSet((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev))
    setGridRefreshKey((k) => k + 1)
  }

  const handleModalClose = () => setModalOpen(false)

  const handleNextSet = () => {
    if (!selectedSet || setList.length === 0) return
    const currentIndex = setList.findIndex((s) => s.id === selectedSet.id)
    const nextSet = setList[currentIndex + 1]
    if (nextSet) setSelectedSet(nextSet)
  }

  const currentSetIndex = selectedSet ? setList.findIndex((s) => s.id === selectedSet.id) : -1
  const hasNextSet = currentSetIndex >= 0 && currentSetIndex < setList.length - 1

  return (
    <div>
      <p className="text-gray-400 text-sm mb-6">
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

      <SetImageGrid
        onSetSelect={handleSetSelect}
        onSetsLoaded={setSetList}
        selectedSetId={selectedSet?.id ?? null}
        refreshKey={gridRefreshKey}
      />

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

// ─────────────────────────────────────────────
// Set Symbols Tab
// ─────────────────────────────────────────────
function SetSymbolsTab() {
  const [selectedSet, setSelectedSet] = useState<SetSymbolGridItem | null>(null)
  const [setList, setSetList] = useState<SetSymbolGridItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [gridRefreshKey, setGridRefreshKey] = useState(0)

  const handleSetSelect = (set: SetSymbolGridItem) => {
    setSelectedSet(set)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_setId: string, symbolUrl: string) => {
    setSelectedSet((prev) => (prev ? { ...prev, symbol_url: symbolUrl } : prev))
    setGridRefreshKey((k) => k + 1)
  }

  const handleModalClose = () => setModalOpen(false)

  const handleNextSet = () => {
    if (!selectedSet || setList.length === 0) return
    const currentIndex = setList.findIndex((s) => s.id === selectedSet.id)
    const nextSet = setList[currentIndex + 1]
    if (nextSet) setSelectedSet(nextSet)
  }

  const currentSetIndex = selectedSet ? setList.findIndex((s) => s.id === selectedSet.id) : -1
  const hasNextSet = currentSetIndex >= 0 && currentSetIndex < setList.length - 1

  return (
    <div>
      <p className="text-gray-400 text-sm mb-6">
        Click a set to open the upload modal, then drag the symbol icon from{' '}
        <a
          href="https://www.pkmn.gg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-400 hover:underline"
        >
          pkmn.gg
        </a>{' '}
        directly into the drop zone. Symbols appear as a small badge in the bottom-left of set cards.
      </p>

      <SetSymbolGrid
        onSetSelect={handleSetSelect}
        onSetsLoaded={setSetList}
        selectedSetId={selectedSet?.id}
        refreshKey={gridRefreshKey}
      />

      <SetSymbolUploadModal
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

// ─────────────────────────────────────────────
// Product Images Tab
// ─────────────────────────────────────────────
function ProductImagesTab() {
  const [selectedSetId, setSelectedSetId]     = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductGridItem | null>(null)
  const [productList, setProductList]         = useState<ProductGridItem[]>([])
  const [modalOpen, setModalOpen]             = useState(false)
  const [gridRefreshKey, setGridRefreshKey]   = useState(0)

  const handleSetSelect = (setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
    setSelectedProduct(null)
    setProductList([])
  }

  const handleProductSelect = (product: ProductGridItem) => {
    setSelectedProduct(product)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_productId: string, imageUrl: string) => {
    setProductList((prev) =>
      prev.map((p) => (p.id === _productId ? { ...p, image_url: imageUrl } : p))
    )
    setGridRefreshKey((k) => k + 1)
  }

  const handleModalClose = () => setModalOpen(false)

  const handleNextProduct = () => {
    if (!selectedProduct || productList.length === 0) return
    const currentIndex = productList.findIndex((p) => p.id === selectedProduct.id)
    const nextProduct = productList[currentIndex + 1]
    if (nextProduct) setSelectedProduct(nextProduct)
  }

  const currentProductIndex = selectedProduct
    ? productList.findIndex((p) => p.id === selectedProduct.id)
    : -1
  const hasNextProduct =
    currentProductIndex >= 0 && currentProductIndex < productList.length - 1

  return (
    <div>
      <p className="text-gray-400 text-sm mb-6">
        Choose a set, browse its sealed products, and click any product to upload or replace its image.
        Drag images directly from{' '}
        <a
          href="https://app.getcollectr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-400 hover:underline"
        >
          Collectr
        </a>
        .
      </p>

      <div className="mb-8">
        <SetSelector
          onSetSelect={handleSetSelect}
          selectedSetId={selectedSetId}
        />
      </div>

      {selectedSetId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {selectedSetName ?? selectedSetId}
            </h2>
            <p className="text-gray-500 text-sm">Click a product to upload its image</p>
          </div>
          <ProductImageGrid
            setId={selectedSetId}
            selectedProductId={selectedProduct?.id ?? null}
            onProductSelect={handleProductSelect}
            onProductsLoaded={setProductList}
            refreshKey={gridRefreshKey}
          />
        </div>
      ) : (
        <div className="text-center py-20 text-gray-600">
          <p className="text-5xl mb-4">📦</p>
          <p className="text-lg">Select a set above to browse its products</p>
        </div>
      )}

      <ProductImageUploadModal
        product={selectedProduct}
        isOpen={modalOpen}
        onClose={handleModalClose}
        onUploadSuccess={handleUploadSuccess}
        onNextProduct={handleNextProduct}
        hasNextProduct={hasNextProduct}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function ImageUploadPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('card-images')

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin/image-upload')
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

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
          <Link href="/admin" className="hover:text-yellow-400 transition-colors">
            🛠️ Admin
          </Link>
          <span>/</span>
          <span className="text-white">Image Upload</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {activeTabMeta.icon} Image Upload
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Switch between card images, set logos, set symbols, and product images using the tabs below.
          </p>
        </div>

        {/* Pill tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 border ${
                activeTab === tab.id
                  ? 'bg-yellow-500 text-black border-yellow-500'
                  : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-yellow-500 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active tab content */}
        {activeTab === 'card-images'    && <CardImagesTab />}
        {activeTab === 'set-images'     && <SetImagesTab />}
        {activeTab === 'set-symbols'    && <SetSymbolsTab />}
        {activeTab === 'product-images' && <ProductImagesTab />}

      </div>
    </div>
  )
}
