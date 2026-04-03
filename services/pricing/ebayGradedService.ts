import { CardSearchData, EbayGradedResult } from './types';
import { buildSearchString, mapVariant } from './cardMatcher';
import { removeOutliers, average, median } from './priceNormalizer';

const PSA_GRADE_REGEX = /PSA\s?(\d+)/i;
const MIN_GRADE = 1;
const MAX_GRADE = 10;
const MIN_ITEMS_PER_GRADE = 2;
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

export async function fetchEbayGradedPrices(card: CardSearchData): Promise<EbayGradedResult[]> {
  try {
    const baseKeywords = buildSearchString(card);
    const keywords = `${baseKeywords} PSA`;

    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': process.env.EBAY_APP_ID ?? '',
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

    const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `[ebayGradedService] Non-200 response for card "${card.id}": ${response.status} ${response.statusText}`
      );
      return [];
    }

    const json = (await response.json()) as EbayFindingResponse;

    const searchResult = json?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
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
