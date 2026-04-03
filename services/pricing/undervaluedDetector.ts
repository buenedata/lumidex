import { createSupabaseServerClient } from '@/lib/supabaseServer'

/**
 * Represents a card that is potentially undervalued on TCGPlayer
 * compared to its CardMarket average sell price.
 */
interface UndervaluedCard {
  cardId: string
  tcgpMarket: number
  cmAvgSell: number
  /** tcgpMarket / cmAvgSell — lower means more undervalued */
  ratio: number
}

/**
 * Check a single card for undervalued status by reading from card_prices.
 *
 * Logic: if tcgp_market < cm_avg_sell * 0.7 (TCGPlayer is >30% cheaper than CardMarket)
 * → the card is potentially undervalued on TCGPlayer.
 *
 * Returns an UndervaluedCard if the condition is met, null otherwise.
 */
export async function checkUndervalued(cardId: string): Promise<UndervaluedCard | null> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('card_prices')
    .select('tcgp_market, cm_avg_sell')
    .eq('card_id', cardId)
    .single()

  if (error) {
    console.error(`[UndervaluedDetector] checkUndervalued(${cardId}): fetch error:`, error.message)
    return null
  }

  if (!data) return null

  const tcgpMarket: number | null = data.tcgp_market
  const cmAvgSell: number | null  = data.cm_avg_sell

  if (tcgpMarket == null || cmAvgSell == null) return null
  if (cmAvgSell <= 0) return null

  const ratio = tcgpMarket / cmAvgSell

  if (tcgpMarket < cmAvgSell * 0.7) {
    return { cardId, tcgpMarket, cmAvgSell, ratio }
  }

  return null
}

/**
 * Scan multiple cards and return all undervalued ones.
 * Runs checks in parallel and logs each undervalued card found.
 */
export async function findUndervaluedCards(cardIds: string[]): Promise<UndervaluedCard[]> {
  const results = await Promise.all(cardIds.map(checkUndervalued))
  const undervalued = results.filter((r): r is UndervaluedCard => r !== null)

  if (undervalued.length > 0) {
    console.log(`[UndervaluedDetector] Found ${undervalued.length} potentially undervalued cards:`)
    undervalued.forEach(c => {
      console.log(
        `  Card ${c.cardId}: TCGPlayer $${c.tcgpMarket} vs CM $${c.cmAvgSell} (ratio: ${c.ratio.toFixed(2)})`
      )
    })
  }

  return undervalued
}
