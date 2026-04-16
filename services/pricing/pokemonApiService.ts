import { CardSearchData, RawPricePoint, PokemonApiPriceResult } from './types';
import { mapVariant } from './cardMatcher';

interface TcgPlayerPriceEntry {
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  market?: number | null;
}

interface TcgPlayerPrices {
  [variantKey: string]: TcgPlayerPriceEntry;
}

interface CardMarketPrices {
  // Normal variant prices
  averageSellPrice?: number | null;
  lowPrice?: number | null;
  trendPrice?: number | null;
  avg1?: number | null;
  avg7?: number | null;
  avg30?: number | null;
  // Reverse holo variant prices (separate listing on CardMarket)
  reverseHoloSell?:   number | null;
  reverseHoloLow?:    number | null;
  reverseHoloTrend?:  number | null;
  reverseHoloAvg1?:   number | null;
  reverseHoloAvg7?:   number | null;
  reverseHoloAvg30?:  number | null;
}

interface PokemonApiResponse {
  data: {
    id: string;
    tcgplayer?: {
      updatedAt?: string;
      prices?: TcgPlayerPrices;
    };
    cardmarket?: {
      url?: string;
      updatedAt?: string;
      prices?: CardMarketPrices;
    };
  };
}

export async function fetchPokemonApiPrices(card: CardSearchData): Promise<PokemonApiPriceResult> {
  if (!card.api_id) {
    return { cardId: card.id, points: [] };
  }

  let data: PokemonApiResponse;

  try {
    const url = `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(card.api_id)}`;
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': process.env.POKEMON_TCG_API_KEY || process.env.POKEMONTCG_API_KEY || '',
      },
    });

    if (!response.ok) {
      console.warn(
        `[pokemonApiService] Non-200 response for card ${card.api_id}: ${response.status} ${response.statusText}`
      );
      return { cardId: card.id, points: [] };
    }

    data = (await response.json()) as PokemonApiResponse;
  } catch (err) {
    console.warn(`[pokemonApiService] Network error fetching card ${card.api_id}:`, err);
    return { cardId: card.id, points: [] };
  }

  const points: RawPricePoint[] = [];

  // --- TCGPlayer prices ---
  const tcgPrices = data?.data?.tcgplayer?.prices;
  if (tcgPrices && typeof tcgPrices === 'object') {
    for (const [apiKey, entry] of Object.entries(tcgPrices)) {
      if (!entry || typeof entry !== 'object') continue;

      const price = entry.market ?? entry.mid ?? null;
      if (!price || price <= 0) {
        console.warn(
          `[pokemonApiService] Skipping TCGPlayer variant "${apiKey}" for card ${card.api_id} — no valid price`
        );
        continue;
      }

      let variantKey = null;
      try {
        variantKey = mapVariant(apiKey);
      } catch {
        console.warn(
          `[pokemonApiService] Could not map TCGPlayer variant key "${apiKey}" for card ${card.api_id}`
        );
        continue;
      }

      const point: RawPricePoint = {
        cardId: card.id,
        source: 'tcgplayer',
        variantKey,
        price,
        currency: 'USD',
        isGraded: false,
      };

      points.push(point);
    }
  }

  // --- CardMarket prices ---
  const cmSection = data?.data?.cardmarket;
  const cmPrices  = cmSection?.prices;
  const cmUrl     = cmSection?.url ?? null;

  if (cmPrices && typeof cmPrices === 'object') {
    // Rough EUR → USD factor used only for the sanity-check below.
    // The actual conversion uses the full normalizer later in the pipeline.
    const EUR_TO_USD_APPROX = 1.09

    // Highest TCGPlayer USD price collected so far — used as a plausibility
    // anchor for CardMarket prices.  A CM price > 50× the TCGPlayer price is
    // a strong signal that pokemontcg.io linked this card to the wrong
    // CardMarket product (e.g. a common matched to an expensive alt-art listing).
    const tcgpMaxUsd = points
      .filter(p => p.source === 'tcgplayer')
      .reduce((best, p) => Math.max(best, p.price), 0)

    // Normal variant price.
    // averageSellPrice is only populated after real sales have occurred (can take
    // weeks for new sets). Fall back to trendPrice then lowPrice so that newly
    // released sets show prices from day 1 instead of showing nothing.
    const normalPrice =
      cmPrices.averageSellPrice ??
      cmPrices.trendPrice       ??
      cmPrices.lowPrice         ??
      null;
    if (normalPrice && normalPrice > 0) {
      const cmNormalUsd = normalPrice * EUR_TO_USD_APPROX
      if (tcgpMaxUsd > 0 && cmNormalUsd > tcgpMaxUsd * 50) {
        console.warn(
          `[pokemonApiService] CM normal price (${normalPrice} EUR ≈ ${cmNormalUsd.toFixed(2)} USD) ` +
          `is >50× TCGPlayer (${tcgpMaxUsd.toFixed(2)} USD) for card ${card.api_id}. ` +
          `Likely wrong CardMarket product match — skipping CM price.`
        )
      } else {
        points.push({
          cardId: card.id,
          source: 'cardmarket',
          variantKey: 'normal',
          price: normalPrice,
          currency: 'EUR',
          isGraded: false,
        });
      }
    } else {
      console.warn(
        `[pokemonApiService] Skipping CM normal price for card ${card.api_id} — averageSellPrice/trendPrice/lowPrice all missing or zero`
      );
    }

    // Reverse holo variant price (separate CardMarket listing)
    // Prefer reverseHoloSell (avg sell) — mirrors how dextcg.com reads CM data
    const reversePrice = cmPrices.reverseHoloSell ?? cmPrices.reverseHoloTrend ?? null;
    if (reversePrice && reversePrice > 0) {
      const cmReverseUsd = reversePrice * EUR_TO_USD_APPROX
      if (tcgpMaxUsd > 0 && cmReverseUsd > tcgpMaxUsd * 50) {
        console.warn(
          `[pokemonApiService] CM reverse price (${reversePrice} EUR) is >50× TCGPlayer for card ${card.api_id} — skipping.`
        )
      } else {
        points.push({
          cardId: card.id,
          source: 'cardmarket',
          variantKey: 'reverse',
          price: reversePrice,
          currency: 'EUR',
          isGraded: false,
        });
      }
    }
  }

  return { cardId: card.id, points, cmUrl };
}
