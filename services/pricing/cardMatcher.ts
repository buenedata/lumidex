import { VariantKey, VALID_VARIANT_KEYS } from './types';

/**
 * Build a search string for a card to use in API/eBay queries
 */
export function buildSearchString(card: { name: string; set_id: string; number: string }): string {
  return `${card.name} ${card.set_id} ${card.number} pokemon`.trim();
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
