import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import type { RelatedCard } from '@/app/api/cards/related/route'
import type { PokemonCard } from '@/types'
import SetPageCards from '@/components/SetPageCards'

// Server-side Supabase client (uses anon key — cards/sets are publicly readable)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

interface BrowsePageProps {
  searchParams: Promise<{ name?: string }>
}

// RelatedCard extended with type for hover-glow support
interface BrowseCard extends RelatedCard {
  type: string | null
}

/**
 * Splits a raw search string into a name part and an optional card-number part.
 *
 * Examples:
 *   "pikachu"        → { name: "pikachu",     number: null }
 *   "pikachu 24"     → { name: "pikachu",     number: "24" }
 *   "pikachu ex 24"  → { name: "pikachu ex",  number: "24" }
 *   "pikachu 24/165" → { name: "pikachu",     number: "24/165" }
 *
 * A trailing token is treated as a number if it starts with a digit
 * (optionally followed by word chars or slashes, e.g. "24", "24/165", "SV01").
 */
function parseSearchQuery(raw: string): { name: string; number: string | null } {
  const match = /^(.+?)\s+(\d[\w/]*)$/.exec(raw.trim())
  if (match) return { name: match[1].trim(), number: match[2] }
  return { name: raw.trim(), number: null }
}

async function searchCards(name: string, number: string | null): Promise<BrowseCard[]> {
  let q = supabase
    .from('cards')
    .select('id, name, number, rarity, type, image, set_id')
    .ilike('name', `%${name}%`)

  if (number) {
    q = q.ilike('number', `%${number}%`)
  }

  const { data: cards, error: cardsError } = await q
    .order('name', { ascending: true })
    .order('set_id', { ascending: true })
    .limit(200)

  if (cardsError || !cards || cards.length === 0) return []

  const setIds = [...new Set(cards.map((c) => c.set_id).filter(Boolean) as string[])]

  const { data: sets } = await supabase
    .from('sets')
    .select('set_id, name, logo_url, release_date')
    .in('set_id', setIds)
    .order('release_date', { ascending: false })

  const setsMap = new Map((sets ?? []).map((s) => [s.set_id, s]))
  const sortedSetIds = (sets ?? []).map((s) => s.set_id)

  return cards
    .map((card) => {
      const setMeta = card.set_id ? setsMap.get(card.set_id) : undefined
      return {
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        type: card.type ?? null,
        image: card.image,
        set_id: card.set_id,
        setName: setMeta?.name ?? null,
        setLogoUrl: setMeta?.logo_url ?? null,
      }
    })
    .sort((a, b) => {
      const ai = sortedSetIds.indexOf(a.set_id ?? '')
      const bi = sortedSetIds.indexOf(b.set_id ?? '')
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const { name: rawName } = await searchParams
  const rawQuery = rawName?.trim() ?? ''

  if (!rawQuery) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="max-w-screen-xl mx-auto px-6 py-12 text-center">
          <p className="text-muted text-lg">No Pokémon name specified.</p>
          <Link href="/sets" className="mt-4 inline-block text-accent hover:underline text-sm">
            ← Browse sets
          </Link>
        </div>
      </div>
    )
  }

  const { name, number } = parseSearchQuery(rawQuery)
  const relatedCards = await searchCards(name, number)

  // Convert BrowseCard → PokemonCard
  // type is included so card-type-* CSS glow classes work on hover
  const cards: PokemonCard[] = relatedCards.map((rc) => ({
    id: rc.id,
    set_id: rc.set_id ?? '',
    name: rc.name,
    number: rc.number,
    rarity: rc.rarity,
    type: rc.type,
    image: rc.image,
    image_url: rc.image ?? '',   // legacy compat for CardGrid
    created_at: '',
  }))

  const setCount = new Set(relatedCards.map((c) => c.set_id).filter(Boolean)).size

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>

      {/* ── Header ── */}
      <div className="border-b border-subtle">
        <div className="max-w-screen-2xl mx-auto px-6 py-6">

          {/* Back link */}
          <Link
            href="/sets"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Browse sets
          </Link>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Title + stats */}
            <div>
              <h1
                className="text-3xl font-bold text-primary mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Results for &ldquo;{rawQuery}&rdquo;
              </h1>
              <p className="text-secondary text-sm">
                {cards.length === 0
                  ? 'No cards found'
                  : `${cards.length} card${cards.length === 1 ? '' : 's'} across ${setCount} set${setCount === 1 ? '' : 's'}`}
              </p>
            </div>

            {/* Most Expensive placeholder */}
            <div className="flex items-center gap-3 bg-elevated border border-subtle rounded-xl px-4 py-3 min-w-[200px]">
              <div className="text-2xl">💰</div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider font-medium mb-0.5">
                  Most Expensive
                </p>
                <p className="text-lg font-bold text-primary leading-none">—</p>
                <p className="text-xs text-muted mt-0.5">Pricing coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cards (identical to set page, no search bar) ── */}
      {cards.length === 0 ? (
        <div className="max-w-screen-2xl mx-auto px-6 text-center py-24">
          <p className="text-muted text-lg mb-2">No cards found for &ldquo;{rawQuery}&rdquo;</p>
          <Link href="/sets" className="text-accent hover:underline text-sm">
            ← Browse sets
          </Link>
        </div>
      ) : (
        <SetPageCards
          cards={cards}
          setTotal={cards.length}
          setName={name}
          showSearch={false}
          setId=""
          hasPromos={cards.some(c => c.rarity?.toLowerCase().includes('promo'))}
        />
      )}
    </div>
  )
}
