'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/analytics/CollectionAnalytics.tsx
//
// Fetches GET /api/analytics/collection, maps the camelCase API response to
// the snake_case component types, and assembles the four sub-panels into a
// tabbed interface.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/Tabs'
import TopValuableCards from './TopValuableCards'
import RarityBreakdown from './RarityBreakdown'
import ValueBySet from './ValueBySet'
import BestWorstPerformers from './BestWorstPerformers'
import type {
  CollectionAnalyticsData,
  TopCard,
  RarityBucket,
  SetValueEntry,
  PerformerCard,
} from './types'

// ── API response shapes (camelCase from server) ───────────────────────────────

interface ApiTopCard {
  cardId: string
  name: string
  setName: string
  setId: string
  rarity: string | null
  imageUrl: string | null
  priceEur: number
  quantity: number
  totalValueEur: number
}

interface ApiRarityBucket {
  rarity: string
  cardCount: number
  totalValueEur: number
}

interface ApiSetValueEntry {
  setId: string
  setName: string
  cardCount: number
  totalValueEur: number
}

interface ApiPerformerCard {
  cardId: string
  name: string
  setName: string
  setId: string
  priceEur: number
  priceEur30dAgo: number
  changePercent: number
}

interface ApiCollectionAnalytics {
  topCards: ApiTopCard[]
  rarityBreakdown: ApiRarityBucket[]
  valueBySet: ApiSetValueEntry[]
  bestPerformers: ApiPerformerCard[]
  worstPerformers: ApiPerformerCard[]
  currency: 'EUR'
}

// ── API → component type mappers ─────────────────────────────────────────────

function mapTopCards(cards: ApiTopCard[]): TopCard[] {
  return cards.map(c => ({
    card_id:      c.cardId,
    card_name:    c.name,
    set_name:     c.setName,
    variant_type: c.rarity ?? '',
    image_url:    c.imageUrl,
    value_eur:    c.totalValueEur,
    quantity:     c.quantity,
  }))
}

function mapRarityBreakdown(buckets: ApiRarityBucket[]): RarityBucket[] {
  return buckets.map(b => ({
    rarity:         b.rarity,
    card_count:     b.cardCount,
    total_value_eur: b.totalValueEur,
  }))
}

function mapValueBySet(sets: ApiSetValueEntry[]): SetValueEntry[] {
  return sets.map(s => ({
    set_id:          s.setId,
    set_name:        s.setName,
    total_value_eur: s.totalValueEur,
    card_count:      s.cardCount,
  }))
}

function mapPerformers(performers: ApiPerformerCard[]): PerformerCard[] {
  return performers.map(p => ({
    card_id:          p.cardId,
    card_name:        p.name,
    variant_type:     '',   // not returned by the performers endpoint
    image_url:        null, // not returned by the performers endpoint
    price_change_eur: Math.round((p.priceEur - p.priceEur30dAgo) * 100) / 100,
    price_change_pct: p.changePercent,
  }))
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TabContentSkeleton() {
  return (
    <div className="space-y-2.5 pt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-700 rounded-xl h-14" />
      ))}
    </div>
  )
}

function PerformersSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
      {Array.from({ length: 2 }).map((_, col) => (
        <div key={col} className="space-y-2">
          <div className="animate-pulse bg-gray-700 rounded h-5 w-28 mb-3" />
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="animate-pulse bg-gray-700 rounded-lg h-12" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CollectionAnalytics() {
  const { profile } = useAuthStore()
  const currency: string = (profile as any)?.preferred_currency ?? 'USD'

  const [data, setData]       = useState<CollectionAnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/analytics/collection')
      .then(async res => {
        if (res.status === 402) {
          // Pro gate — return empty data for the blurred mockup preview
          return {
            topCards:        [],
            rarityBreakdown: [],
            valueBySet:      [],
            bestPerformers:  [],
            worstPerformers: [],
            currency:        'EUR' as const,
          } satisfies ApiCollectionAnalytics
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? `Request failed (${res.status})`)
        }
        return res.json() as Promise<ApiCollectionAnalytics>
      })
      .then(raw => {
        if (cancelled) return
        setData({
          top_cards:        mapTopCards(raw.topCards),
          rarity_breakdown: mapRarityBreakdown(raw.rarityBreakdown),
          value_by_set:     mapValueBySet(raw.valueBySet),
          best_performers:  mapPerformers(raw.bestPerformers),
          worst_performers: mapPerformers(raw.worstPerformers),
        })
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center text-sm text-gray-400">
        Failed to load analytics data: {error}
      </div>
    )
  }

  return (
    <Tabs defaultValue="top-cards">
      <TabsList>
        <TabsTrigger value="top-cards">Top Cards</TabsTrigger>
        <TabsTrigger value="by-rarity">By Rarity</TabsTrigger>
        <TabsTrigger value="by-set">By Set</TabsTrigger>
        <TabsTrigger value="performers">Performers</TabsTrigger>
      </TabsList>

      <TabsContent value="top-cards" className="pt-3">
        {isLoading
          ? <TabContentSkeleton />
          : <TopValuableCards cards={data?.top_cards ?? []} currency={currency} />
        }
      </TabsContent>

      <TabsContent value="by-rarity" className="pt-3">
        {isLoading
          ? <TabContentSkeleton />
          : <RarityBreakdown data={data?.rarity_breakdown ?? []} />
        }
      </TabsContent>

      <TabsContent value="by-set" className="pt-3">
        {isLoading
          ? <TabContentSkeleton />
          : <ValueBySet data={data?.value_by_set ?? []} currency={currency} />
        }
      </TabsContent>

      <TabsContent value="performers" className="pt-3">
        {isLoading
          ? <PerformersSkeleton />
          : (
            <BestWorstPerformers
              bestPerformers={data?.best_performers ?? []}
              worstPerformers={data?.worst_performers ?? []}
            />
          )
        }
      </TabsContent>
    </Tabs>
  )
}
