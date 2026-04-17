'use client'

/**
 * useItemPrice — client-side hook for fetching a single item's price.
 *
 * Calls `GET /api/prices/{itemType}/{itemId}?variant={variant}` and returns
 * the raw price + currency. No formatting, no caching, no currency conversion.
 *
 * Display rules for consumers:
 * - Render `price` as-is (e.g. `€3.50`) or `—` when `price` is null.
 * - All prices are returned in EUR — no conversion needed.
 * - Format the number yourself (toFixed, Intl.NumberFormat, etc.).
 *
 * @example
 * const { price, currency, loading, error } = useItemPrice(card.id, 'single', 'reverse_holo')
 * if (loading) return <Spinner />
 * return <span>{price !== null ? `${currency} ${price.toFixed(2)}` : '—'}</span>
 */

import { useState, useEffect } from 'react'
import type { ItemType } from '@/types/pricing'

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseItemPriceResult {
  price: number | null
  currency: string
  loading: boolean
  error: string | null
}

// ─── API response shapes ──────────────────────────────────────────────────────

interface PriceSuccessResponse {
  price: number | null
  currency: string
  updated_at: string
}

interface PriceErrorResponse {
  error: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useItemPrice(
  itemId: string | null | undefined,
  itemType: ItemType,
  variant: string = 'normal',
): UseItemPriceResult {
  const [price, setPrice] = useState<number | null>(null)
  const [currency, setCurrency] = useState<string>('EUR')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!itemId) {
      setPrice(null)
      setCurrency('EUR')
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()

    async function fetchPrice() {
      setLoading(true)
      setError(null)

      try {
        const url = `/api/prices/${itemType}/${itemId}?variant=${encodeURIComponent(variant)}`
        const res = await fetch(url, { signal: controller.signal })

        if (!res.ok) {
          const body = (await res.json()) as PriceErrorResponse
          setError(body.error ?? 'Failed to load price')
          setPrice(null)
        } else {
          const body = (await res.json()) as PriceSuccessResponse
          setPrice(body.price)
          setCurrency(body.currency)
          setError(null)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError('Failed to load price')
        setPrice(null)
      } finally {
        setLoading(false)
      }
    }

    fetchPrice()

    return () => controller.abort()
  }, [itemId, itemType, variant])

  return { price, currency, loading, error }
}
