import { Variant, VariantWithQuantity } from '@/types'

export type VariantColor = 'green' | 'blue' | 'purple' | 'red' | 'pink' | 'yellow' | 'gray' | 'orange' | 'teal';

export type VariantType =
  | "normal"
  | "reverse"
  | "holo"
  | "pokeball"
  | "masterball"
  | "custom";

// Default variant configurations — global catalog, not tied to specific cards
export const DEFAULT_VARIANTS: Omit<Variant, 'id' | 'created_at'>[] = [
  {
    key: 'normal',
    name: 'Normal',
    description: 'Standard card version',
    color: 'green',
    short_label: 'N',
    is_quick_add: true,
    sort_order: 1,
    is_official: true,
    created_by: null,
  },
  {
    key: 'reverse',
    name: 'Reverse Holo',
    description: 'Reverse holofoil version',
    color: 'blue',
    short_label: 'R',
    is_quick_add: true,
    sort_order: 2,
    is_official: true,
    created_by: null,
  },
  {
    key: 'holo',
    name: 'Holo Rare',
    description: 'Holofoil version',
    color: 'purple',
    short_label: 'H',
    is_quick_add: true,
    sort_order: 3,
    is_official: true,
    created_by: null,
  },
  {
    key: 'pokeball',
    name: 'Pokéball',
    description: 'Special Pokéball variant',
    color: 'red',
    short_label: 'PB',
    is_quick_add: false,
    sort_order: 4,
    is_official: true,
    created_by: null,
  },
  {
    key: 'masterball',
    name: 'Master Ball',
    description: 'Special Master Ball variant',
    color: 'pink',
    short_label: 'MB',
    is_quick_add: false,
    sort_order: 5,
    is_official: true,
    created_by: null,
  },
  {
    key: 'custom',
    name: 'Custom',
    description: 'Custom variant',
    color: 'yellow',
    short_label: 'C',
    is_quick_add: false,
    sort_order: 6,
    is_official: true,
    created_by: null,
  },
];

export function extractCardNumber(cardNumber: string): number {
  // Handles formats like "123/197" or "TG10/TG30"
  const match = cardNumber.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function isSecretRare(cardNumber: string, setTotal: number): boolean {
  const num = extractCardNumber(cardNumber);
  return num > setTotal;
}

// ONLY add sets here if you KNOW they have special variants
const SET_VARIANT_CONFIG: Record<string, string[]> = {
  // example:
  // "futureSetId": ["normal", "pokeball", "masterball"],
};

/**
 * Get available variants for a card based on its properties
 * Returns variant IDs that should be available for this card
 */
export function getAvailableVariantIds(
  card: { number: string; name?: string; rarity?: string },
  setTotal: number,
  allVariants: Variant[]
): string[] {
  const cardName = card.name?.toLowerCase() || '';
  const rarity = card.rarity?.toLowerCase() || '';

  // Get variant IDs by their names for easy mapping
  const variantIdMap = allVariants.reduce((map, variant) => {
    map[variant.name.toLowerCase()] = variant.id;
    return map;
  }, {} as Record<string, string>);

  // Secret rares = ONLY holo
  if (isSecretRare(card.number, setTotal)) {
    return [variantIdMap['holo']].filter(Boolean);
  }

  // Check if this is an EX/V card (check both name and rarity)
  const isExOrV = cardName.includes(' ex') || rarity.includes('ex') ||
                  cardName.includes(' v') || rarity.includes(' v');

  // EX/V cards = ONLY holo (no normal, no reverse)
  if (isExOrV) {
    return [variantIdMap['holo']].filter(Boolean);
  }

  // Holo rarity cards get holo + reverse (NO normal)
  if (rarity.includes("holo")) {
    return [variantIdMap['reverse holo'], variantIdMap['holo']].filter(Boolean);
  }

  // Regular/common cards get normal + reverse (NO holo)
  return [variantIdMap['normal'], variantIdMap['reverse holo']].filter(Boolean);
}

/**
 * Legacy function for backward compatibility
 * Maps old VariantType[] to new Variant system
 */
export function getAvailableVariants(
  card: { number: string; name?: string; rarity?: string },
  setTotal: number
): VariantType[] {
  const cardName = card.name?.toLowerCase() || '';
  const rarity = card.rarity?.toLowerCase() || '';

  // Secret rares = ONLY holo
  if (isSecretRare(card.number, setTotal)) {
    return ["holo"];
  }

  // Check if this is an EX/V card (check both name and rarity)
  const isExOrV = cardName.includes(' ex') || rarity.includes('ex') ||
                  cardName.includes(' v') || rarity.includes(' v');

  // EX/V cards = ONLY holo (no normal, no reverse)
  if (isExOrV) {
    return ["holo"];
  }

  // Holo rarity cards get holo + reverse (NO normal)
  if (rarity.includes("holo")) {
    return ["reverse", "holo"];
  }

  // Regular/common cards get normal + reverse (NO holo)
  return ["normal", "reverse"];
}

/**
 * Filter variants to only show those appropriate for a specific card.
 * Variants are a global catalog — which apply is determined by card rarity rules.
 */
export function filterVariantsForCard(
  variants: Variant[],
  card: { id: string; number: string; name?: string; rarity?: string },
  setTotal: number
): Variant[] {
  // Apply business logic to filter global variants based on card rarity/type
  const availableVariantIds = getAvailableVariantIds(card, setTotal, variants);
  return variants.filter(v => availableVariantIds.includes(v.id));
}

/**
 * Get quick-add variants for a card (used in the collection UI)
 */
export function getQuickAddVariants(
  variants: Variant[],
  card: { id: string; number: string; name?: string; rarity?: string },
  setTotal: number
): Variant[] {
  const filteredVariants = filterVariantsForCard(variants, card, setTotal);
  return filteredVariants
    .filter(v => v.is_quick_add)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Merge variant data with user quantities
 */
export function mergeVariantsWithQuantities(
  variants: Variant[],
  userVariants: { variant_id: string; quantity: number }[]
): VariantWithQuantity[] {
  const quantityMap = userVariants.reduce((map, uv) => {
    map[uv.variant_id] = uv.quantity;
    return map;
  }, {} as Record<string, number>);

  return variants.map(variant => ({
    ...variant,
    quantity: quantityMap[variant.id] || 0,
  }));
}

/**
 * Resolve available variant IDs for a card, respecting per-card overrides.
 *
 * Priority:
 *   1. If `overrideVariantIds` is non-empty → use them as-is (admin-configured)
 *   2. Otherwise → fall back to `getAvailableVariantIds()` (rarity rules)
 *
 * Use this wherever variant availability is computed so that admin overrides
 * stored in `card_variant_availability` take precedence over hardcoded logic.
 */
export function resolveAvailableVariantIds(
  card: { number: string; name?: string; rarity?: string },
  setTotal: number,
  allVariants: Variant[],
  overrideVariantIds?: string[]
): string[] {
  if (overrideVariantIds && overrideVariantIds.length > 0) {
    return overrideVariantIds
  }
  return getAvailableVariantIds(card, setTotal, allVariants)
}

/**
 * Override-aware version of filterVariantsForCard.
 * Returns the Variant objects that should be shown for a card, applying
 * admin-configured per-card overrides when present.
 */
export function resolveVariantsForCard(
  variants: Variant[],
  card: { id: string; number: string; name?: string; rarity?: string },
  setTotal: number,
  overrideVariantIds?: string[]
): Variant[] {
  const ids = resolveAvailableVariantIds(card, setTotal, variants, overrideVariantIds)
  return variants.filter(v => ids.includes(v.id))
}
