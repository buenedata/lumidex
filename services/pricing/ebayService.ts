/**
 * eBay Raw (Ungraded) Price Service — Browse API
 *
 * Fetches ungraded sold listings via the eBay Browse API (OAuth, v1).
 * Replaced the deprecated Finding API (findCompletedItems on svcs.ebay.com)
 * which was returning HTTP 500.
 *
 * Auth: Application-level OAuth token via getEbayAppToken() (shared cache)
 * Scope: https://api.ebay.com/oauth/api_scope
 */

import { CardSearchData, EbayPriceResult, VariantKey } from './types';
import { buildEbaySearchString, mapVariant } from './cardMatcher';
import { removeOutliers, average, median } from './priceNormalizer';
import { searchBrowseCompletedItems } from './ebayGradedService';

// ── Constants ─────────────────────────────────────────────────────────────────

const BUNDLE_KEYWORDS = ['lot', 'bundle', 'x10', 'x20', '100x'];
const GRADED_KEYWORDS = ['psa', 'bgs', 'cgc', 'sgc', 'graded'];
const MIN_PRICE = 0.10;
const MAX_PRICE = 5000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBundle(title: string): boolean {
  const lower = title.toLowerCase();
  return BUNDLE_KEYWORDS.some(kw => lower.includes(kw));
}

/** Exclude listings that are clearly graded — they belong in ebayGradedService. */
function isGraded(title: string): boolean {
  const lower = title.toLowerCase();
  return GRADED_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchEbayRawPrices(card: CardSearchData): Promise<EbayPriceResult | null> {
  try {
    const keywords = buildEbaySearchString(card);

    let items: Array<{ title?: string; price?: { value?: string; currency?: string } }>;
    try {
      const result = await searchBrowseCompletedItems(keywords);
      items = result.items;
    } catch (err) {
      console.warn(
        `[ebayService] Browse API call failed for card "${card.id}":`,
        err instanceof Error ? err.message : err
      );
      return null;
    }

    if (!items.length) {
      console.warn(`[ebayService] No eBay results found for card "${card.id}"`);
      return null;
    }

    const prices: number[] = [];
    let firstValidTitle: string | null = null;

    for (const item of items) {
      const title = item.title ?? '';

      // Skip bundles and graded listings (graded are handled by ebayGradedService)
      if (isBundle(title) || isGraded(title)) continue;

      const rawPrice = item.price?.value;
      if (!rawPrice) continue;

      const price = parseFloat(rawPrice);
      if (isNaN(price) || price < MIN_PRICE || price > MAX_PRICE) continue;

      prices.push(price);
      if (firstValidTitle === null) firstValidTitle = title;
    }

    if (!prices.length) {
      console.warn(`[ebayService] No valid prices after filtering for card "${card.id}"`);
      return null;
    }

    const cleaned = removeOutliers(prices);
    if (!cleaned.length) {
      console.warn(`[ebayService] All prices removed by outlier filter for card "${card.id}"`);
      return null;
    }

    const avg = average(cleaned);
    const med = median(cleaned);

    if (avg === null || med === null) {
      console.warn(`[ebayService] Could not compute average/median for card "${card.id}"`);
      return null;
    }

    let variantKey: VariantKey | null = null;
    if (firstValidTitle) {
      try {
        variantKey = mapVariant(firstValidTitle);
      } catch {
        variantKey = null;
      }
    }

    return {
      cardId:     card.id,
      average:    avg,
      median:     med,
      currency:   'USD',
      variantKey,
      sampleSize: cleaned.length,
      isGraded:   false,
    };
  } catch (err) {
    console.warn(`[ebayService] Unexpected error for card "${card.id}":`, err);
    return null;
  }
}
