import { VariantKey, VALID_VARIANT_KEYS } from './types';

/**
 * Build a search string for a card to use in API/eBay queries.
 * Includes the internal set_id (e.g. "sv4pt5") — suitable for TCGPlayer/PokemonTCG API calls.
 */
export function buildSearchString(card: { name: string; set_id: string; number: string }): string {
  return `${card.name} ${card.set_id} ${card.number} pokemon`.trim();
}

/**
 * Build an eBay-optimised search string.
 * Omits the internal set_id (e.g. "sv4pt5") which eBay sellers never use.
 * Adds "card" to filter out non-card merchandise.
 *
 * @example
 *   buildEbaySearchString({ name: 'Charizard', number: '4' })
 *   // → "Charizard 4 pokemon card"
 */
export function buildEbaySearchString(card: { name: string; number: string }): string {
  return `${card.name} ${card.number} pokemon card`.trim();
}

/**
 * Returns true if an eBay listing title appears to be for the specified card number.
 *
 * eBay's fuzzy search often returns higher-profile cards with the same name but a
 * different collector number (e.g. searching for "Yanmega EX 3/244" may return
 * "Yanmega EX 228/182 SIR" because short numbers carry little search weight).
 * This filter rejects those mismatches by checking the numeric part of the card
 * number against the "/" notation that collectors always include in listing titles.
 *
 * Handles zero-padded variants automatically:
 *   card "3"   → matches "3/244", "03/244", "003/244"  — rejects "228/182", "103/244"
 *   card "228" → matches "228/182"                      — rejects "3/244"
 *
 * If the card number is non-numeric (e.g. promo "SWSH001") the function always
 * returns true because we cannot reliably validate those formats.
 */
export function titleMatchesCardNumber(title: string, cardNumber: string): boolean {
  const numPart = cardNumber.split('/')[0].trim();
  const num = parseInt(numPart, 10);
  if (isNaN(num)) return true; // non-numeric number — skip validation

  // Match the card number at a word boundary, optionally zero-padded, followed by "/"
  // (the slash is the key — every collector writes "3/244" or "228/182" in listings).
  // \b0*N\/ catches "3/", "03/", "003/" for N=3 but NOT "103/" or "228/".
  const regex = new RegExp(`\\b0*${num}\\/`);
  return regex.test(title.toLowerCase());
}

/**
 * Normalize an API variant key to a valid DB variant key.
 *
 * Rules:
 * 1. Lowercase + replace spaces with underscore + remove special chars
 * 2. Exact match against VALID_VARIANT_KEYS
 * 3. Keyword rules:
 *    - contains 'reverse' → 'reverse'   (DB key is 'reverse', NOT 'reverse_holo')
 *    - contains 'holo' (but not reverse) → 'holo'
 *    - contains '1st' or 'first' → null (no 1st edition in variants table)
 *    - contains 'pokeball' → 'pokeball'
 *    - contains 'masterball' → 'masterball'
 * 4. Only return if valid in VALID_VARIANT_KEYS
 * 5. Fallback → 'normal'
 */
export function mapVariant(apiKey: string | null | undefined): VariantKey {
  if (!apiKey) return 'normal';

  const normalized = apiKey
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  // Exact match
  if (VALID_VARIANT_KEYS.includes(normalized as VariantKey)) {
    return normalized as VariantKey;
  }

  // Keyword rules
  if (normalized.includes('reverse')) return 'reverse';
  if (normalized.includes('masterball')) return 'masterball';
  if (normalized.includes('pokeball')) return 'pokeball';
  if (normalized.includes('holo')) return 'holo';

  // 1st edition: no matching variant in DB → default to 'normal'
  if (normalized.includes('1st') || normalized.includes('first')) return 'normal';

  return 'normal';
}
