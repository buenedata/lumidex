import { CardSearchData, EbayGradedResult } from './types';
import { buildEbaySearchString, mapVariant } from './cardMatcher';
import { removeOutliers, average, median } from './priceNormalizer';

const PSA_GRADE_REGEX = /PSA\s?(\d+)/i;
const MIN_GRADE = 1;
const MAX_GRADE = 10;
export const MIN_ITEMS_PER_GRADE = 1; // lowered from 2 — captures low-volume sets
const MIN_PRICE = 0.10;
const MAX_PRICE = 5000;

interface EbayFindingItem {
  title?: string[];
  sellingStatus?: Array<{
    currentPrice?: Array<{ __value__?: string }>;
  }>;
}

interface EbayFindingResponse {
  findCompletedItemsResponse?: Array<{
    ack?: string[];
    errorMessage?: Array<{
      error?: Array<{
        message?: string[];
        errorId?: string[];
        domain?: string[];
      }>;
    }>;
    searchResult?: Array<{
      '@count'?: string;
      item?: EbayFindingItem[];
    }>;
  }>;
}

interface GradeGroup {
  prices: number[];
  titles: string[];
}

/** Build the eBay Finding API URL for graded sold listings of a card. */
export function buildGradedSearchUrl(card: { name: string; number: string }): string {
  const baseKeywords = buildEbaySearchString(card);
  const keywords = `${baseKeywords} PSA graded`;

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': process.env.EBAY_CLIENT_ID ?? '',
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    keywords,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'ListingType',
    'itemFilter(1).value': 'FixedPrice',
    'itemFilter(2).name': 'Condition',
    'itemFilter(2).value(0)': '1000',
    'itemFilter(2).value(1)': '3000',
    sortOrder: 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '50',
  });

  return `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`;
}

/** Raw diagnostic data returned by probeEbayGradedSearch. */
export interface EbayGradedProbeResult {
  searchKeywords: string;
  httpStatus: number;
  ack: string | null;
  apiErrorMessages: string[];
  rawItemCount: number;
  itemsSample: Array<{ title: string; price: string | null }>;
  parsedGrades: Record<number, { priceCount: number; avg: number | null }>;
  finalResults: EbayGradedResult[];
}

/**
 * Probe the eBay graded search for a single card and return full debug data.
 * Used by the admin probe endpoint — does NOT save anything to the database.
 */
export async function probeEbayGradedSearch(
  card: CardSearchData
): Promise<EbayGradedProbeResult> {
  const url = buildGradedSearchUrl(card);
  const baseKeywords = buildEbaySearchString(card);
  const searchKeywords = `${baseKeywords} PSA graded`;

  const response = await fetch(url);
  const httpStatus = response.status;

  let rawJson: EbayFindingResponse = {};
  try {
    rawJson = (await response.json()) as EbayFindingResponse;
  } catch {
    return {
      searchKeywords,
      httpStatus,
      ack: null,
      apiErrorMessages: ['Failed to parse eBay API response as JSON'],
      rawItemCount: 0,
      itemsSample: [],
      parsedGrades: {},
      finalResults: [],
    };
  }

  const responseRoot = rawJson?.findCompletedItemsResponse?.[0];
  const ack = responseRoot?.ack?.[0] ?? null;

  // Extract any error messages from the eBay API response
  const apiErrorMessages: string[] = [];
  const errors = responseRoot?.errorMessage?.[0]?.error ?? [];
  for (const err of errors) {
    const msg = err.message?.[0];
    if (msg) apiErrorMessages.push(msg);
  }

  const searchResult = responseRoot?.searchResult?.[0];
  const items: EbayFindingItem[] = searchResult?.item ?? [];
  const rawItemCount = parseInt(searchResult?.['@count'] ?? '0', 10);

  const itemsSample = items.slice(0, 5).map(item => ({
    title: item.title?.[0] ?? '(no title)',
    price: item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? null,
  }));

  // Run the same parsing logic as the real service
  const gradeGroups = new Map<number, GradeGroup>();

  for (const item of items) {
    const title = item.title?.[0] ?? '';
    const gradeMatch = PSA_GRADE_REGEX.exec(title);
    if (!gradeMatch) continue;

    const grade = parseInt(gradeMatch[1], 10);
    if (isNaN(grade) || grade < MIN_GRADE || grade > MAX_GRADE) continue;

    const rawPrice = item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
    if (!rawPrice) continue;

    const price = parseFloat(rawPrice);
    if (isNaN(price) || price < MIN_PRICE || price > MAX_PRICE) continue;

    if (!gradeGroups.has(grade)) {
      gradeGroups.set(grade, { prices: [], titles: [] });
    }
    const group = gradeGroups.get(grade)!;
    group.prices.push(price);
    group.titles.push(title);
  }

  const parsedGrades: Record<number, { priceCount: number; avg: number | null }> = {};
  for (const [grade, group] of gradeGroups.entries()) {
    const cleaned = removeOutliers(group.prices);
    parsedGrades[grade] = { priceCount: group.prices.length, avg: average(cleaned) };
  }

  // Build final results using same logic as fetchEbayGradedPrices
  const finalResults = await fetchEbayGradedPrices(card);

  return {
    searchKeywords,
    httpStatus,
    ack,
    apiErrorMessages,
    rawItemCount,
    itemsSample,
    parsedGrades,
    finalResults,
  };
}

export async function fetchEbayGradedPrices(card: CardSearchData): Promise<EbayGradedResult[]> {
  try {
    const url = buildGradedSearchUrl(card);

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `[ebayGradedService] Non-200 response for card "${card.id}": ${response.status} ${response.statusText}`
      );
      return [];
    }

    const json = (await response.json()) as EbayFindingResponse;

    const responseRoot = json?.findCompletedItemsResponse?.[0];

    // Check eBay API-level ack — "Failure" means auth or request error
    const ack = responseRoot?.ack?.[0];
    if (ack === 'Failure') {
      const errors = responseRoot?.errorMessage?.[0]?.error ?? [];
      const messages = errors.map(e => e.message?.[0]).filter(Boolean).join('; ');
      console.warn(
        `[ebayGradedService] eBay API returned ack=Failure for card "${card.id}": ${messages || '(no error message)'}`
      );
      return [];
    }

    const searchResult = responseRoot?.searchResult?.[0];
    const items: EbayFindingItem[] = searchResult?.item ?? [];

    if (!items.length) {
      console.warn(`[ebayGradedService] No eBay graded results found for card "${card.id}"`);
      return [];
    }

    // Group items by PSA grade
    const gradeGroups = new Map<number, GradeGroup>();

    for (const item of items) {
      const title = item.title?.[0] ?? '';

      const gradeMatch = PSA_GRADE_REGEX.exec(title);
      if (!gradeMatch) continue;

      const grade = parseInt(gradeMatch[1], 10);
      if (isNaN(grade) || grade < MIN_GRADE || grade > MAX_GRADE) continue;

      const rawPrice = item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
      if (!rawPrice) continue;

      const price = parseFloat(rawPrice);
      if (isNaN(price) || price < MIN_PRICE || price > MAX_PRICE) continue;

      if (!gradeGroups.has(grade)) {
        gradeGroups.set(grade, { prices: [], titles: [] });
      }

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
        console.warn(
          `[ebayGradedService] All prices removed by outlier filter for PSA ${grade}, card "${card.id}"`
        );
        continue;
      }

      const avg = average(cleaned);
      const med = median(cleaned);

      if (avg === null || med === null) {
        console.warn(
          `[ebayGradedService] Could not compute average/median for PSA ${grade}, card "${card.id}"`
        );
        continue;
      }

      // Extract variant from first title in the group
      let variantKey = null;
      const firstTitle = group.titles[0];
      if (firstTitle) {
        try {
          variantKey = mapVariant(firstTitle);
        } catch {
          variantKey = null;
        }
      }

      results.push({
        cardId: card.id,
        gradingCompany: 'PSA',
        grade,
        average: avg,
        median: med,
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
