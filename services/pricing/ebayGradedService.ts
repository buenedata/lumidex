/**
 * eBay Graded Price Service — Browse API
 *
 * Fetches PSA, CGC and ACE graded sold listings via the eBay Browse API (OAuth).
 * Runs one search per grading company, parses grade numbers from listing titles,
 * and returns averaged price data per (company, grade).
 *
 * Auth: Application-level OAuth token via getEbayAppToken()
 * Scope: https://api.ebay.com/oauth/api_scope
 */

import { getEbayAppToken } from '@/lib/ebayAuth';
import { CardSearchData, EbayGradedResult, GradingCompany } from './types';
import { buildEbaySearchString, mapVariant, titleMatchesCardNumber } from './cardMatcher';
import { removeOutliers, average, median } from './priceNormalizer';

// ── Constants ─────────────────────────────────────────────────────────────────

const BROWSE_BASE    = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const MARKETPLACE_ID = 'EBAY_US';

export const MIN_ITEMS_PER_GRADE = 1;   // 1 allows low-volume sets to register prices

/**
 * Only parse grades in this set. We focus on the two most-valuable tiers:
 * PSA 10, PSA 9, CGC 10, CGC 9. All other grades are ignored to keep sync fast.
 */
const GRADES_OF_INTEREST = new Set([9, 10]);

/**
 * Cards with these rarities are almost never graded — skipping the eBay search
 * for them saves ~(n_commons + n_uncommons) × ~800ms per set sync.
 * Typically 50–70% of cards in a set are Common or Uncommon.
 */
const LOW_RARITY_SKIP = new Set(['common', 'uncommon']);

/**
 * Returns true when the card's rarity means we will skip the eBay graded search.
 * Exported so the orchestrator can skip the post-call sleep for these cards too —
 * an unlaunched eBay call needs no rate-limit delay.
 */
export function isRaritySkippedForGraded(rarity: string | null | undefined): boolean {
  if (!rarity) return false;
  return LOW_RARITY_SKIP.has(rarity.toLowerCase());
}

/**
 * Maximum eBay sold listings to consider per (company, grade) combination.
 * 3 data points is enough to produce a reliable average for display purposes.
 * Keeping this low prevents high-volume cards from accumulating more data than needed.
 */
const MAX_ITEMS_PER_GRADE = 3;

const MIN_PRICE  = 0.10;
const MAX_PRICE  = 5000;

/**
 * Companies we actively track. ACE is omitted — the volume of ACE listings
 * on eBay is too low to produce reliable price signals for most cards.
 * Only PSA and CGC are included.
 */
const COMPANY_CONFIG: Partial<Record<GradingCompany, { suffix: string; regex: RegExp }>> = {
  PSA: { suffix: 'PSA graded', regex: /PSA\s*(\d+)/i },
  CGC: { suffix: 'CGC graded', regex: /CGC\s*(\d+)/i },
};

// ── Browse API types ──────────────────────────────────────────────────────────

interface BrowseItemSummary {
  title?: string;
  price?: { value?: string; currency?: string };
}

interface BrowseSearchResponse {
  total?: number;
  itemSummaries?: BrowseItemSummary[];
}

interface GradeGroup {
  prices: number[];
  titles: string[];
}

// ── Shared Browse API helper ──────────────────────────────────────────────────

/**
 * Call the eBay Browse API for completed/sold fixed-price listings.
 * Throws with a descriptive message on HTTP or OAuth failure.
 * Exported for use in the probe endpoint.
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

// ── Internal: parse one company's search results into grade groups ─────────────

function parseGradeGroups(
  items: BrowseItemSummary[],
  gradeRegex: RegExp
): Map<number, GradeGroup> {
  const groups = new Map<number, GradeGroup>();

  for (const item of items) {
    const title = item.title ?? '';

    const gradeMatch = gradeRegex.exec(title);
    if (!gradeMatch) continue;

    const grade = parseInt(gradeMatch[1], 10);
    // Only process the grades we care about (9 and 10)
    if (isNaN(grade) || !GRADES_OF_INTEREST.has(grade)) continue;

    const rawPrice = item.price?.value;
    if (!rawPrice) continue;

    const price = parseFloat(rawPrice);
    if (isNaN(price) || price < MIN_PRICE || price > MAX_PRICE) continue;

    if (!groups.has(grade)) groups.set(grade, { prices: [], titles: [] });
    const group = groups.get(grade)!;

    // Cap at MAX_ITEMS_PER_GRADE — stop collecting once we have enough data points
    if (group.prices.length >= MAX_ITEMS_PER_GRADE) continue;

    group.prices.push(price);
    group.titles.push(title);
  }

  return groups;
}

// ── Internal: convert grade groups to EbayGradedResult[] ─────────────────────

function gradeGroupsToResults(
  cardId: string,
  company: GradingCompany,
  gradeGroups: Map<number, GradeGroup>
): EbayGradedResult[] {
  const results: EbayGradedResult[] = [];

  for (const [grade, group] of gradeGroups.entries()) {
    if (group.prices.length < MIN_ITEMS_PER_GRADE) {
      console.warn(
        `[ebayGradedService] ${company} ${grade} for card "${cardId}" has only ${group.prices.length} item(s) — skipping`
      );
      continue;
    }

    const cleaned = removeOutliers(group.prices);
    if (!cleaned.length) {
      console.warn(`[ebayGradedService] All prices removed by outlier filter for ${company} ${grade}, card "${cardId}"`);
      continue;
    }

    const avg = average(cleaned);
    const med = median(cleaned);
    if (avg === null || med === null) continue;

    let variantKey = null;
    try {
      variantKey = mapVariant(group.titles[0]);
    } catch {
      variantKey = null;
    }

    results.push({
      cardId,
      gradingCompany: company,
      grade,
      average: avg,
      median:  med,
      currency: 'USD',
      variantKey,
      sampleSize: cleaned.length,
    });
  }

  return results;
}

// ── Probe (diagnostic) ────────────────────────────────────────────────────────

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
 * Probe the eBay graded search for a single card (PSA only — for diagnostics).
 * Returns full debug data without saving anything to the database.
 */
export async function probeEbayGradedSearch(
  card: CardSearchData
): Promise<EbayGradedProbeResult> {
  const baseKeywords   = buildEbaySearchString(card);
  // Probe uses PSA as the representative company
  // Non-null assertion is safe: PSA is always present in COMPANY_CONFIG
  const config         = COMPANY_CONFIG['PSA']!;
  const searchKeywords = `${baseKeywords} ${config.suffix}`;

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
    if (msg.includes('OAuth token fetch failed')) tokenError = msg;
    else tokenError = msg;
    return {
      searchKeywords, httpStatus, tokenSnippet, tokenError,
      rawItemCount: 0, apiTotal: 0, itemsSample: [], parsedGrades: {}, finalResults: [],
    };
  }

  const itemsSample = items.slice(0, 5).map(item => ({
    title:    item.title ?? '(no title)',
    price:    item.price?.value ?? null,
    currency: item.price?.currency ?? null,
  }));

  const gradeGroups = parseGradeGroups(items, config!.regex);

  const parsedGrades: Record<number, { priceCount: number; avg: number | null }> = {};
  for (const [grade, group] of gradeGroups.entries()) {
    const cleaned = removeOutliers(group.prices);
    parsedGrades[grade] = { priceCount: group.prices.length, avg: average(cleaned) };
  }

  const finalResults = await fetchEbayGradedPrices(card);

  return {
    searchKeywords, httpStatus, tokenSnippet, tokenError,
    rawItemCount: items.length, apiTotal, itemsSample, parsedGrades, finalResults,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch eBay last-sold graded prices for PSA and CGC — one Browse API call per card.
 *
 * A single query `"${name} ${number} pokemon card graded"` captures both companies
 * in one round-trip. Only grades 9 and 10 are extracted (GRADES_OF_INTEREST), and
 * at most MAX_ITEMS_PER_GRADE (3) data points per (company, grade) combination.
 *
 * Returns an empty array immediately if eBay returns no listings — the caller
 * should skip the card gracefully in that case.
 */
export async function fetchEbayGradedPrices(card: CardSearchData): Promise<EbayGradedResult[]> {
  // Skip Common and Uncommon cards — graded versions have negligible market value
  // and eBay almost never has sold listings for them at PSA/CGC 9 or 10.
  // This can skip 50–70% of cards in a typical set, saving significant sync time.
  if (card.rarity && LOW_RARITY_SKIP.has(card.rarity.toLowerCase())) {
    return [];
  }

  const baseKeywords = buildEbaySearchString(card);
  // Single broad query — catches PSA and CGC in one round-trip
  // We request only 20 items: 2 companies × 2 grades × 3 max + buffer
  const keywords = `${baseKeywords} graded`;

  let items: BrowseItemSummary[];
  try {
    const result = await searchBrowseCompletedItems(keywords, 20);
    items = result.items;
  } catch (err) {
    console.warn(
      `[ebayGradedService] Browse API call failed for card "${card.id}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  if (!items.length) {
    // No results at all — skip this card without logging a warning (common for low-value commons)
    return [];
  }

  // Reject listings for a different card number.
  // eBay's fuzzy search can return a same-named card with a different collector
  // number (e.g. Yanmega EX 228/182 SIR instead of Yanmega EX 3/244) when the
  // target number is short and carries little search weight. Filter those out
  // before parsing grades so we never store prices for the wrong card.
  const filteredItems = items.filter(item =>
    titleMatchesCardNumber(item.title ?? '', card.number)
  );

  if (!filteredItems.length) {
    console.log(
      `[ebayGradedService] No items matched card number "${card.number}" for card "${card.id}" — skipping (likely dominated by a same-name variant)`
    );
    return [];
  }

  // Apply PSA and CGC regexes to the filtered item list.
  // Grades outside GRADES_OF_INTEREST (< 9) are ignored in parseGradeGroups.
  const allResults: EbayGradedResult[] = [];
  const companyEntries = Object.entries(COMPANY_CONFIG) as [GradingCompany, NonNullable<typeof COMPANY_CONFIG[GradingCompany]>][];

  for (const [company, config] of companyEntries) {
    const gradeGroups = parseGradeGroups(filteredItems, config.regex);
    if (!gradeGroups.size) continue;

    const results = gradeGroupsToResults(card.id, company, gradeGroups);
    if (results.length > 0) {
      console.log(`[ebayGradedService] ${company}: ${results.length} grade(s) found for card "${card.id}"`);
      allResults.push(...results);
    }
  }

  return allResults;
}
