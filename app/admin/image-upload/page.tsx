'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { GAMES, type GameSlug } from '@/lib/games'

// Unified image upload wizard (Card Images + Set Images)
import { ImageUploadWizard } from '../../../components/admin/ImageUploadWizard'
import { GamePicker } from '../../../components/admin/GamePicker'

// Set Symbols imports
import { SetSymbolGrid, type SetSymbolGridItem } from '../../../components/admin/SetSymbolGrid'
import { SetSymbolUploadModal } from '../../../components/admin/SetSymbolUploadModal'

// Product Images imports
import { SetSelector } from '../../../components/admin/SetSelector'
import { ProductImageGrid, type ProductGridItem } from '../../../components/admin/ProductImageGrid'
import { ProductImageUploadModal } from '../../../components/admin/ProductImageUploadModal'

// Source Images import
import { LinkSourceImagesTab } from '../../../components/admin/LinkSourceImagesTab'

// ─────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────
const TABS = [
  { id: 'images',          label: 'Card & Set Images', icon: '🖼️' },
  { id: 'set-symbols',     label: 'Set Symbols',       icon: '🔷' },
  { id: 'product-images',  label: 'Product Images',    icon: '📦' },
  { id: 'source-images',   label: 'Source Images',     icon: '🔗' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─────────────────────────────────────────────
// Shared: mini breadcrumb with "change game" link
// ─────────────────────────────────────────────
function GameBreadcrumb({
  selectedGame,
  onChangeGame,
}: {
  selectedGame: GameSlug
  onChangeGame: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm mb-6">
      <button onClick={onChangeGame} className="text-yellow-400 hover:underline font-medium">
        {GAMES[selectedGame].displayName}
      </button>
      <span className="text-gray-600">— click to change TCG</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Set Symbols Tab
// ─────────────────────────────────────────────
function SetSymbolsTab() {
  const [selectedGame, setSelectedGame]     = useState<GameSlug | null>(null)
  const [selectedSet, setSelectedSet]       = useState<SetSymbolGridItem | null>(null)
  const [setList, setSetList]               = useState<SetSymbolGridItem[]>([])
  const [modalOpen, setModalOpen]           = useState(false)
  const [gridRefreshKey, setGridRefreshKey] = useState(0)

  const handleSetSelect = (set: SetSymbolGridItem) => {
    setSelectedSet(set)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_setId: string, symbolUrl: string) => {
    setSelectedSet((prev) => (prev ? { ...prev, symbol_url: symbolUrl } : prev))
    setGridRefreshKey((k) => k + 1)
  }

  const handleNextSet = () => {
    if (!selectedSet || setList.length === 0) return
    const currentIndex = setList.findIndex((s) => s.id === selectedSet.id)
    const nextSet = setList[currentIndex + 1]
    if (nextSet) setSelectedSet(nextSet)
  }

  const currentSetIndex = selectedSet ? setList.findIndex((s) => s.id === selectedSet.id) : -1
  const hasNextSet = currentSetIndex >= 0 && currentSetIndex < setList.length - 1

  // ── Step 1: choose game ──────────────────────────────────────────────────
  if (!selectedGame) {
    return (
      <div>
        <p className="text-gray-400 text-sm mb-6">
          Choose a TCG first, then select a set to upload its symbol icon.
        </p>
        <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold">1</span>
          Choose a TCG
        </h2>
        <GamePicker selectedGame={null} onGameSelect={setSelectedGame} />
      </div>
    )
  }

  // ── Step 2: symbol grid ──────────────────────────────────────────────────
  return (
    <div>
      <GameBreadcrumb selectedGame={selectedGame} onChangeGame={() => setSelectedGame(null)} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm">
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
        <button
          onClick={() => setGridRefreshKey((k) => k + 1)}
          className="ml-4 shrink-0 text-xs text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-1"
        >
          ↻ Refresh
        </button>
      </div>

      <SetSymbolGrid
        onSetSelect={handleSetSelect}
        onSetsLoaded={setSetList}
        selectedSetId={selectedSet?.id}
        refreshKey={gridRefreshKey}
        game={selectedGame}
      />

      <SetSymbolUploadModal
        set={selectedSet}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
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
  const [selectedGame, setSelectedGame]               = useState<GameSlug | null>(null)
  const [selectedSetId, setSelectedSetId]             = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName]         = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct]         = useState<ProductGridItem | null>(null)
  const [productList, setProductList]                 = useState<ProductGridItem[]>([])
  const [modalOpen, setModalOpen]                     = useState(false)
  const [gridRefreshKey, setGridRefreshKey]           = useState(0)
  const [selectorRefreshKey, setSelectorRefreshKey]   = useState(0)
  const [imageOverrides, setImageOverrides]           = useState<Record<string, string>>({})

  const handleSetSelect = (setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
    setSelectedProduct(null)
    setProductList([])
    setImageOverrides({})
  }

  const handleProductSelect = (product: ProductGridItem) => {
    setSelectedProduct(product)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_productId: string, imageUrl: string) => {
    setImageOverrides((prev) => ({ ...prev, [_productId]: imageUrl }))
    setProductList((prev) =>
      prev.map((p) => (p.id === _productId ? { ...p, image_url: imageUrl } : p))
    )
    setSelectedProduct((prev) =>
      prev?.id === _productId ? { ...prev, image_url: imageUrl } : prev
    )
    setGridRefreshKey((k) => k + 1)
  }

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

  // ── Step 1: choose game ──────────────────────────────────────────────────
  if (!selectedGame) {
    return (
      <div>
        <p className="text-gray-400 text-sm mb-6">
          Choose a TCG first, then select a set to upload its sealed product images.
        </p>
        <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500 text-black text-xs font-bold">1</span>
          Choose a TCG
        </h2>
        <GamePicker selectedGame={null} onGameSelect={setSelectedGame} />
      </div>
    )
  }

  // ── Step 2+: set selector + product grid ────────────────────────────────
  return (
    <div>
      <GameBreadcrumb selectedGame={selectedGame} onChangeGame={() => setSelectedGame(null)} />

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
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setSelectorRefreshKey((k) => k + 1)}
            className="text-xs text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-1"
            title="Re-fetch the sets list from the database"
          >
            ↻ Refresh sets
          </button>
        </div>
        <SetSelector
          onSetSelect={handleSetSelect}
          selectedSetId={selectedSetId}
          refreshKey={selectorRefreshKey}
          game={selectedGame}
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
            imageOverrides={imageOverrides}
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
        onClose={() => setModalOpen(false)}
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
  const [activeTab, setActiveTab] = useState<TabId>('images')

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
            Switch between image types using the tabs below. Each flow starts by choosing a TCG.
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
        {activeTab === 'images'         && <ImageUploadWizard />}
        {activeTab === 'set-symbols'    && <SetSymbolsTab />}
        {activeTab === 'product-images' && <ProductImagesTab />}
        {activeTab === 'source-images'  && <LinkSourceImagesTab />}

      </div>
    </div>
  )
}
