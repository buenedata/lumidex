/**
 * eBay Graded Price Service — Browse API
 *
 * Fetches PSA graded sold listings via the eBay Browse API (OAuth, v1).
 * Replaced the deprecated Finding API (findCompletedItems on svcs.ebay.com)
 * which was returning HTTP 500.
 *
 * Auth: Application-level OAuth token via getEbayAppToken()
 * Scope: https://api.ebay.com/oauth/api_scope
 */

import { getEbayAppToken } from '@/lib/ebayAuth';
import { CardSearchData, EbayGradedResult } from './types';
import { buildEbaySearchString, mapVariant } from './cardMatcher';
import { removeOutliers, average, median } from './priceNormalizer';

// ── Constants ─────────────────────────────────────────────────────────────────

const BROWSE_BASE    = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const MARKETPLACE_ID = 'EBAY_US';

const PSA_GRADE_REGEX   = /PSA\s?(\d+)/i;
const MIN_GRADE          = 1;
const MAX_GRADE          = 10;
export const MIN_ITEMS_PER_GRADE = 1;   // 1 allows low-volume sets to register prices
const MIN_PRICE          = 0.10;
const MAX_PRICE          = 5000;

// ── Browse API types ──────────────────────────────────────────────────────────

interface BrowseItemSummary {
  title?: string;
  price?: { value?: string; currency?: string };
}

interface BrowseSearchResponse {
  total?: number;
  itemSummaries?: BrowseItemSummary[];
  warnings?: Array<{ message?: string; errorId?: string }>;
}

interface GradeGroup {
  prices: number[];
  titles: string[];
}

// ── Shared Browse API helper ──────────────────────────────────────────────────

/**
 * Call the eBay Browse API for completed/sold fixed-price listings.
 * Returns the raw item list, or throws with a descriptive message on failure.
 *
 * @internal — exported for use in probeEbayGradedSearch
 */
export async function searchBrowseCompletedItems(
  keywords: string,
  limit = 50
): Promise<{ items: BrowseItemSummary[]; total: number; httpStatus: number; tokenSnippet: string }> {
  let token: string;
  try {
    token = await getEbayAppToken();
  } catch (err) {
    throw new Error(
      `[ebayGradedService] OAuth token fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Only log first 20 chars so the token is never fully exposed in logs
  const tokenSnippet = token.slice(0, 20) + '…';

  const params = new URLSearchParams({
    q:      keywords,
    filter: 'buyingOptions:{FIXED_PRICE},completedItems:true',
    limit:  String(limit),
    sort:   'endTimeSoonest',
  });

  const url = `${BROWSE_BASE}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'Authorization':            `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID':  MARKETPLACE_ID,
      'Content-Type':             'application/json',
    },
  });

  const httpStatus = response.status;

  if (!response.ok) {
    let errBody = '';
    try { errBody = await response.text() } catch { /* ignore */ }
    throw new Error(
      `[ebayGradedService] Browse API HTTP ${httpStatus} for query "${keywords}": ${errBody.slice(0, 200)}`
    );
  }

  const json = (await response.json()) as BrowseSearchResponse;
  return {
    items:       json.itemSummaries ?? [],
    total:       json.total ?? 0,
    httpStatus,
    tokenSnippet,
  };
}

// ── Probe (diagnostic) ────────────────────────────────────────────────────────

/** Raw diagnostic data returned by probeEbayGradedSearch. */
export interface EbayGradedProbeResult {
  searchKeywords:   string;
  httpStatus:       number;
  tokenSnippet:     string;
  tokenError:       string | null;
  rawItemCount:     number;
  apiTotal:         number;
  itemsSample:      Array<{ title: string; price: string | null; currency: string | null }>;
  parsedGrades:     Record<number, { priceCount: number; avg: number | null }>;
  finalResults:     EbayGradedResult[];
}

/**
 * Probe the eBay graded search for a single card and return full debug data.
 * Used by the admin probe endpoint — does NOT save anything to the database.
 */
export async function probeEbayGradedSearch(
  card: CardSearchData
): Promise<EbayGradedProbeResult> {
  const baseKeywords   = buildEbaySearchString(card);
  const searchKeywords = `${baseKeywords} PSA graded`;

  let httpStatus   = 0;
  let tokenSnippet = '';
  let tokenError: string | null = null;
  let items: BrowseItemSummary[] = [];
  let apiTotal = 0;

  try {
    const result = await searchBrowseCompletedItems(searchKeywords);
    httpStatus   = result.httpStatus;
    tokenSnippet = result.tokenSnippet;
    items        = result.items;
    apiTotal     = result.total;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('OAuth token fetch failed')) {
      tokenError = msg;
    }
    return {
      searchKeywords,
      httpStatus,
      tokenSnippet,
      tokenError,
      rawItemCount:  0,
      apiTotal:      0,
      itemsSample:   [],
      parsedGrades:  {},
      finalResults:  [],
    };
  }

  const itemsSample = items.slice(0, 5).map(item => ({
    title:    item.title ?? '(no title)',
    price:    item.price?.value ?? null,
    currency: item.price?.currency ?? null,
  }));

  // Run the same grade-parsing logic as fetchEbayGradedPrices
  const gradeGroups = new Map<number, GradeGroup>();

  for (const item of items) {
    const title = item.title ?? '';
    const gradeMatch = PSA_GRADE_REGEX.exec(title);
    if (!gradeMatch) continue;

    const grade = parseInt(gradeMatch[1], 10);
    if (isNaN(grade) || grade < MIN_GRADE || grade > MAX_GRADE) continue;

    const rawPrice = item.price?.value;
    if (!rawPrice) continue;

    const price = parseFloat(rawPrice);
    if (isNaN(price) || price < MIN_PRICE || price > MAX_PRICE) continue;

    if (!gradeGroups.has(grade)) gradeGroups.set(grade, { prices: [], titles: [] });
    const group = gradeGroups.get(grade)!;
    group.prices.push(price);
    group.titles.push(title);
  }

  const parsedGrades: Record<number, { priceCount: number; avg: number | null }> = {};
  for (const [grade, group] of gradeGroups.entries()) {
    const cleaned = removeOutliers(group.prices);
    parsedGrades[grade] = { priceCount: group.prices.length, avg: average(cleaned) };
  }

  // Run the full pipeline to get final filtered results
  const finalResults = await fetchEbayGradedPrices(card);

  return {
    searchKeywords,
    httpStatus,
    tokenSnippet,
    tokenError,
    rawItemCount: items.length,
    apiTotal,
    itemsSample,
    parsedGrades,
    finalResults,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchEbayGradedPrices(card: CardSearchData): Promise<EbayGradedResult[]> {
  try {
    const baseKeywords = buildEbaySearchString(card);
    const keywords     = `${baseKeywords} PSA graded`;

    let items: BrowseItemSummary[];
    try {
      const result = await searchBrowseCompletedItems(keywords);
      items = result.items;
    } catch (err) {
      console.warn(`[ebayGradedService] Browse API call failed for card "${card.id}":`, err instanceof Error ? err.message : err);
      return [];
    }

    if (!items.length) {
      console.warn(`[ebayGradedService] No eBay graded results found for card "${card.id}"`);
      return [];
    }

    // Group items by PSA grade
    const gradeGroups = new Map<number, GradeGroup>();

    for (const item of items) {
      const title = item.title ?? '';

      const gradeMatch = PSA_GRADE_REGEX.exec(title);
      if (!gradeMatch) continue;

      const grade = parseInt(gradeMatch[1], 10);
      if (isNaN(grade) || grade < MIN_GRADE || grade > MAX_GRADE) continue;

      const rawPrice = item.price?.value;
      if (!rawPrice) continue;

      const price = parseFloat(rawPrice);
      if (isNaN(price) || price < MIN_PRICE || price > MAX_PRICE) continue;

      if (!gradeGroups.has(grade)) gradeGroups.set(grade, { prices: [], titles: [] });
      const group = gradeGroups.get(grade)!;
      group.prices.push(price);
      group.titles.push(title);
    }

    if (!gradeGroups.size) {
      console.warn(`[ebayGradedService] No valid graded items found for card "${card.id}"`);
      return [];
    }

    const results: EbayGradedResult[] = [];

    for (const [grade, group] of gradeGroups.entries()) {
      if (group.prices.length < MIN_ITEMS_PER_GRADE) {
        console.warn(
          `[ebayGradedService] PSA ${grade} for card "${card.id}" has only ${group.prices.length} item(s) — skipping`
        );
        continue;
      }

      const cleaned = removeOutliers(group.prices);
      if (!cleaned.length) {
        console.warn(`[ebayGradedService] All prices removed by outlier filter for PSA ${grade}, card "${card.id}"`);
        continue;
      }

      const avg = average(cleaned);
      const med = median(cleaned);
      if (avg === null || med === null) {
        console.warn(`[ebayGradedService] Could not compute average/median for PSA ${grade}, card "${card.id}"`);
        continue;
      }

      let variantKey = null;
      try {
        variantKey = mapVariant(group.titles[0]);
      } catch {
        variantKey = null;
      }

      results.push({
        cardId: card.id,
        gradingCompany: 'PSA',
        grade,
        average: avg,
        median:  med,
        currency: 'USD',
        variantKey,
        sampleSize: cleaned.length,
      });
    }

    return results;
  } catch (err) {
    console.warn(`[ebayGradedService] Unexpected error for card "${card.id}":`, err);
    return [];
  }
}
