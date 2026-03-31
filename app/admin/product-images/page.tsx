'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { SetSelector } from '../../../components/admin/SetSelector'
import { ProductImageGrid, type ProductGridItem } from '../../../components/admin/ProductImageGrid'
import { ProductImageUploadModal } from '../../../components/admin/ProductImageUploadModal'

export default function ProductImagesPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [selectedSetId, setSelectedSetId]     = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductGridItem | null>(null)
  const [productList, setProductList]         = useState<ProductGridItem[]>([])
  const [modalOpen, setModalOpen]             = useState(false)
  const [gridRefreshKey, setGridRefreshKey]   = useState(0)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin/product-images')
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
    setSelectedProduct(null)
    setProductList([])
  }

  const handleProductSelect = (product: ProductGridItem) => {
    setSelectedProduct(product)
    setModalOpen(true)
  }

  const handleUploadSuccess = (_productId: string, imageUrl: string) => {
    // Patch the in-memory list so the grid shows the new image immediately
    setProductList((prev) =>
      prev.map((p) => (p.id === _productId ? { ...p, image_url: imageUrl } : p))
    )
    // Also increment refresh key to re-fetch from server on next open
    setGridRefreshKey((k) => k + 1)
  }

  const handleModalClose = () => {
    setModalOpen(false)
  }

  const handleNextProduct = () => {
    if (!selectedProduct || productList.length === 0) return
    const currentIndex = productList.findIndex((p) => p.id === selectedProduct.id)
    const nextProduct  = productList[currentIndex + 1]
    if (nextProduct) {
      setSelectedProduct(nextProduct)
    }
  }

  const currentProductIndex = selectedProduct
    ? productList.findIndex((p) => p.id === selectedProduct.id)
    : -1
  const hasNextProduct =
    currentProductIndex >= 0 && currentProductIndex < productList.length - 1

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
            <span className="text-white">Product Image Upload</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            📦 Product Image Upload
          </h1>
          <p className="text-gray-400 mt-1">
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
        </div>

        {/* Set selector */}
        <div className="mb-8">
          <SetSelector
            onSetSelect={handleSetSelect}
            selectedSetId={selectedSetId}
          />
        </div>

        {/* Product grid */}
        {selectedSetId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {selectedSetName ?? selectedSetId}
              </h2>
              <p className="text-gray-500 text-sm">
                Click a product to upload its image
              </p>
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

        {/* Upload modal */}
        <ProductImageUploadModal
          product={selectedProduct}
          isOpen={modalOpen}
          onClose={handleModalClose}
          onUploadSuccess={handleUploadSuccess}
          onNextProduct={handleNextProduct}
          hasNextProduct={hasNextProduct}
        />
      </div>
    </div>
  )
}
