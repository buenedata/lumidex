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
  averageSellPrice?: number | null;
  lowPrice?: number | null;
  trendPrice?: number | null;
  avg30?: number | null;
}

interface PokemonApiResponse {
  data: {
    id: string;
    tcgplayer?: {
      updatedAt?: string;
      prices?: TcgPlayerPrices;
    };
    cardmarket?: {
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
  const cmPrices = data?.data?.cardmarket?.prices;
  if (cmPrices && typeof cmPrices === 'object') {
    const price = cmPrices.averageSellPrice ?? null;
    if (price && price > 0) {
      const point: RawPricePoint = {
        cardId: card.id,
        source: 'cardmarket',
        variantKey: 'normal',
        price,
        currency: 'EUR',
        isGraded: false,
      };
      points.push(point);
    } else {
      console.warn(
        `[pokemonApiService] Skipping CardMarket price for card ${card.api_id} — averageSellPrice missing or zero`
      );
    }
  }

  return { cardId: card.id, points };
}
