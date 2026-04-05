-- ── Add CardMarket reverse holo price + CardMarket URL to card_prices ─────────
--
-- Background: the pokemontcg.io API returns separate CardMarket prices for the
-- reverse holo variant (reverseHoloSell, reverseHoloTrend, etc.) as well as a
-- direct URL to the card's CardMarket product page. These were previously not
-- stored, causing both Normal and Reverse Holo to display the same price.
--
-- Run this migration in Supabase SQL editor, then re-sync prices for all sets.

ALTER TABLE public.card_prices
  ADD COLUMN IF NOT EXISTS cm_reverse_holo numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cm_url          text;

COMMENT ON COLUMN public.card_prices.cm_reverse_holo
  IS 'CardMarket average sell price for the reverse holo variant (EUR). Populated from reverseHoloSell in the pokemontcg.io API response.';

COMMENT ON COLUMN public.card_prices.cm_url
  IS 'Direct URL to this card on CardMarket (e.g. https://www.cardmarket.com/en/Pokemon/Products/Singles/...).';
