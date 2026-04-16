import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import type { SeriesProductGroup } from '@/types'
import ProductsPageClient from '@/components/ProductsPageClient'

// Opt out of static pre-rendering: reads auth cookies at request time.
export const dynamic = 'force-dynamic'

interface ProductsPageProps {
  searchParams: Promise<{ series?: string }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { series: rawSeries } = await searchParams

  // Decode series from query param (e.g. "Scarlet+%26+Violet" → "Scarlet & Violet")
  const initialSeries = rawSeries ? decodeURIComponent(rawSeries) : 'All'

  let allSeries: SeriesProductGroup[] = []
  let ownedQuantities: Record<string, number> = {}
  let userId: string | null = null
  let currency = 'USD'
  let error: string | null = null

  // Products will be empty until the new pricing system is implemented
  allSeries = []

  // Fetch auth user + preferences + owned quantities
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      userId = user.id

      const [profileResult, ownedResult] = await Promise.all([
          supabaseAdmin
            .from('users')
            .select('preferred_currency')
            .eq('id', user.id)
            .maybeSingle(),
          supabaseAdmin
            .from('user_sealed_products')
            .select('product_id, quantity')
            .eq('user_id', user.id),
        ])
  
        if (profileResult.data?.preferred_currency) {
          currency = profileResult.data.preferred_currency
        }

      // Build productId → quantity map
      for (const row of (ownedResult.data ?? [])) {
        ownedQuantities[row.product_id as string] = row.quantity as number
      }
    }
  } catch (err) {
    // Auth errors are non-fatal — guest view still works
    console.warn('[products page] Could not fetch user session:', err)
  }

  // Error state
  if (error) {
    return (
      <div style={{ backgroundColor: 'var(--color-bg-base)' }} className="min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sets
          </Link>
          <div className="text-center py-16">
            <div className="text-red-400">⚠️ {error}</div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state (no products synced yet)
  if (allSeries.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--color-bg-base)' }} className="min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sets
          </Link>
          <div className="text-center py-24">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-muted mb-2">No sealed products available yet</p>
            <p className="text-xs text-muted/70">
              Sealed product prices are synced automatically. Check back soon.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Determine total product count for subtitle
  const totalProducts = allSeries.reduce(
    (sum, g) => sum + g.sets.reduce((s2, s) => s2 + s.products.length, 0),
    0
  )

  return (
    <div style={{ backgroundColor: 'var(--color-bg-base)' }} className="min-h-screen">
      {/* ── Hero banner ──────────────────────────────────────────────────── */}
      <div className="relative w-full h-40 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-[#0a0a0f] to-[#0a0a0f]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />

        {/* Back link */}
        <div className="absolute top-4 left-6 z-20">
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Sets
          </Link>
        </div>

        {/* Hero content */}
        <div className="relative z-10 h-full max-w-screen-2xl mx-auto px-6 flex items-end pb-6 gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
            <span className="text-2xl">📦</span>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-0.5">Browse</p>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Sealed Products
            </h1>
          </div>
          <span className="ml-2 text-xs text-muted bg-elevated px-2 py-0.5 rounded-full self-end mb-1">
            {totalProducts} products
          </span>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <ProductsPageClient
          allSeries={allSeries}
          initialSeries={initialSeries}
          ownedQuantities={ownedQuantities}
          userId={userId}
          currency={currency}
        />
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Sealed Products | Lumidex',
  description: 'Browse and track your Pokémon TCG sealed product collection.',
}
