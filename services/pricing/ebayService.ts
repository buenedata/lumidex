import { CardSearchData, EbayPriceResult, VariantKey } from './types';
import { buildEbaySearchString, mapVariant } from './cardMatcher';
import { removeOutliers, average, median } from './priceNormalizer';

const BUNDLE_KEYWORDS = ['lot', 'bundle', 'x10', 'x20', '100x'];
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

function isBundle(title: string): boolean {
  const lower = title.toLowerCase();
  return BUNDLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchEbayRawPrices(card: CardSearchData): Promise<EbayPriceResult | null> {
  try {
    // buildEbaySearchString omits the internal set_id (e.g. "base1") which
    // eBay sellers never use, improving match relevance significantly.
    const keywords = buildEbaySearchString(card);

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

    const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `[ebayService] Non-200 response for card "${card.id}": ${response.status} ${response.statusText}`
      );
      return null;
    }

    const json = (await response.json()) as EbayFindingResponse;

    const searchResult = json?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
    const items: EbayFindingItem[] = searchResult?.item ?? [];

    if (!items.length) {
      console.warn(`[ebayService] No eBay results found for card "${card.id}"`);
      return null;
    }

    const prices: number[] = [];
    let firstValidTitle: string | null = null;

    for (const item of items) {
      const title = item.title?.[0] ?? '';
      if (isBundle(title)) continue;

      const rawPrice = item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
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
      cardId: card.id,
      average: avg,
      median: med,
      currency: 'USD',
      variantKey,
      sampleSize: cleaned.length,
      isGraded: false,
    };
  } catch (err) {
    console.warn(`[ebayService] Unexpected error for card "${card.id}":`, err);
    return null;
  }
}
