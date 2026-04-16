import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/artists/[name]/bio
 *
 * Returns a bio for a Pokémon TCG card artist.
 *
 * OpenAI is not available in this project (no OPENAI_API_KEY / openai package),
 * so this endpoint returns a tasteful placeholder bio.
 *
 * Response: { bio: string, generated: boolean }
 */

// Cache for 24 hours at the edge
export const revalidate = 86400

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const artistName = decodeURIComponent(name).trim()

  if (!artistName) {
    return NextResponse.json({ error: 'Artist name is required' }, { status: 400 })
  }

  // ── Placeholder bio (OpenAI not configured) ────────────────────────────────
  const bio = [
    `${artistName} is a talented illustrator who has contributed to the Pokémon Trading Card Game, ` +
    `bringing beloved Pokémon to life with a distinctive artistic style that fans have come to recognise ` +
    `across multiple card sets.`,

    `Their work spans a range of Pokémon TCG expansions, showcasing a keen eye for capturing the ` +
    `personality and energy of each Pokémon. Whether depicting serene natural scenes or dynamic battle ` +
    `moments, ${artistName}'s illustrations add depth and character to the cards they adorn.`,

    `Collectors and players alike appreciate the craftsmanship behind every piece, making cards ` +
    `illustrated by ${artistName} a highlight in any Pokémon TCG collection.`,
  ].join('\n\n')

  return NextResponse.json({ bio, generated: false })
}
