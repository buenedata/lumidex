import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ArtistDetailClient from '@/components/ArtistDetailClient'
import type { ArtistCard } from '@/components/ArtistDetailClient'

// Always fetch fresh data — artist card lists can grow over time.
export const dynamic = 'force-dynamic'

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ name: string }> },
): Promise<Metadata> {
  const { name } = await params
  const artistName = decodeURIComponent(name)

  return {
    title:       `${artistName} | Lumidex Artists`,
    description: `Explore all Pokémon cards illustrated by ${artistName}. Browse every card this artist has created for the Pokémon Trading Card Game.`,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ArtistDetailPage(
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const artistName = decodeURIComponent(name).trim()

  if (!artistName) {
    notFound()
  }

  // Fetch all cards by this artist using the admin client so RLS does not
  // filter out results for unauthenticated visitors. Card catalogue data is
  // public — no user-specific rows are involved in this query.
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('id, name, image, set_id, number, rarity, sets!set_id(name, symbol:symbol_url, setComplete)')
    .ilike('artist', artistName)
    .order('set_id',  { ascending: true })
    .order('number',  { ascending: true })
    .limit(2000)

  if (error) {
    console.error('[ArtistDetailPage] DB error:', error)
    // Fall through to notFound; don't expose DB errors to clients
    notFound()
  }

  if (!data || data.length === 0) {
    notFound()
  }

  const cards = data as ArtistCard[]

  return (
    <ArtistDetailClient
      artistName={artistName}
      initialCards={cards}
    />
  )
}
