'use client'

import { useState, useEffect } from 'react'

export interface ProductGridItem {
  id: string
  set_id: string
  name: string
  product_type: string | null
  image_url: string | null
}

// Product type badge colours (mirrors ProductCard.tsx)
const PRODUCT_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  'Booster Pack':    { bg: 'bg-green-500/20',  text: 'text-green-400'  },
  'Booster Box':     { bg: 'bg-blue-500/20',   text: 'text-blue-400'   },
  'Elite Trainer Box': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'ETB':             { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  'Booster Bundle':  { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  'Collection Box':  { bg: 'bg-pink-500/20',   text: 'text-pink-400'   },
  'Tin':             { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'Blister Pack':    { bg: 'bg-teal-500/20',   text: 'text-teal-400'   },
}

function getTypeStyle(type: string | null) {
  if (!type) return { bg: 'bg-gray-500/20', text: 'text-gray-400' }
  if (PRODUCT_TYPE_STYLES[type]) return PRODUCT_TYPE_STYLES[type]
  for (const [key, style] of Object.entries(PRODUCT_TYPE_STYLES)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return style
  }
  return { bg: 'bg-gray-500/20', text: 'text-gray-400' }
}

interface Props {
  setId: string
  selectedProductId: string | null
  onProductSelect: (product: ProductGridItem) => void
  onProductsLoaded: (products: ProductGridItem[]) => void
  refreshKey?: number
}

export function ProductImageGrid({
  setId,
  selectedProductId,
  onProductSelect,
  onProductsLoaded,
  refreshKey = 0,
}: Props) {
  const [products, setProducts] = useState<ProductGridItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!setId) return

    setLoading(true)
    setError(null)

    fetch(`/api/products-for-set?setId=${encodeURIComponent(setId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setProducts([])
          onProductsLoaded([])
        } else {
          setProducts(data.products ?? [])
          onProductsLoaded(data.products ?? [])
        }
      })
      .catch((err) => {
        setError(String(err))
        setProducts([])
        onProductsLoaded([])
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, refreshKey])

  if (loading) {
    return (
      <div className="text-gray-400 animate-pulse py-8 text-center">
        Loading products…
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        ❌ {error}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-gray-500 py-8 text-center text-sm">
        No products found for this set. Prices may not have been synced yet.
      </div>
    )
  }

  const withImage    = products.filter((p) => p.image_url)
  const withoutImage = products.filter((p) => !p.image_url)

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-400">
          <span className="text-white font-semibold">{products.length}</span> products total
        </span>
        <span className="text-green-400">
          ✅ {withImage.length} with image
        </span>
        <span className="text-gray-500">
          ⬜ {withoutImage.length} missing
        </span>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {products.map((product) => {
          const isSelected = product.id === selectedProductId
          const typeStyle  = getTypeStyle(product.product_type)

          return (
            <button
              key={product.id}
              onClick={() => onProductSelect(product)}
              className={`
                flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150
                ${isSelected
                  ? 'border-yellow-400 bg-yellow-400/5 ring-1 ring-yellow-400/30'
                  : product.image_url
                    ? 'border-gray-700 bg-gray-900 hover:border-gray-500'
                    : 'border-gray-800 bg-gray-950 hover:border-gray-600'
                }
              `}
            >
              {/* Thumbnail or placeholder */}
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800 flex items-center justify-center">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl opacity-30">📦</span>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium leading-tight truncate">
                  {product.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {product.product_type && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                      {product.product_type}
                    </span>
                  )}
                  {product.image_url ? (
                    <span className="text-xs text-green-500">✅ has image</span>
                  ) : (
                    <span className="text-xs text-gray-600">no image</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
