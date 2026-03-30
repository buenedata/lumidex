import { PokemonCard, PokemonSet } from '@/types'

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Determines if a card is a secret rare based on card number and set total
 *
 * @param cardNumber - Card number as string (e.g. "150", "151")
 * @param setTotal - Total number of cards in the set
 * @returns True if card number is greater than set total
 */
export function isSecretRare(cardNumber: string, setTotal: number): boolean {
  const num = parseInt(cardNumber)

  if (isNaN(num)) return false

  return num > setTotal
}

/**
 * Determines which variant types should be available based on card rarity and set size
 *
 * Filtering rules:
 * - Secret rares (card# > setTotal): Only "holo rare"
 * - Holo rares: "holo rare" + "reverse holo" (no normal)
 * - Normal cards: "normal" + "reverse holo"
 * - EX/V cards: Excluded from reverse holo
 *
 * @param card - Pokemon card with rarity information
 * @param setTotal - Total number of cards in the set
 * @returns Array of variant names that should be available for this card
 */
export function getAvailableVariants(card: PokemonCard, setTotal: number): string[] {
  const rarity = card.rarity?.toLowerCase() || ''
  const cardName = card.name?.toLowerCase() || ''
  const isSecret = isSecretRare(card.number ?? '', setTotal)

  // Secret rares → ONLY holo rare
  if (isSecret) {
    return ["holo rare"]
  }

  let variants: string[] = []

  // Check if this is an EX/V card (check both name and rarity)
  const isExOrV = cardName.includes(' ex') || rarity.includes('ex') || cardName.includes(' v') || rarity.includes(' v')

  // EX/V cards always get holo rare only (no normal, no reverse)
  if (isExOrV) {
    variants = ["holo rare"]
  }
  // Holo cards get holo rare + reverse holo (NO normal)
  else if (rarity.includes("holo")) {
    variants.push("holo rare")
    variants.push("reverse holo")
  }
  // Regular cards get normal + reverse holo
  else {
    variants.push("normal")
    variants.push("reverse holo")
  }

  return variants
}

// ---------------------------------------------------------------------------
// Pokemon type glow system for Set Cards
// ---------------------------------------------------------------------------

export type PokemonType =
  | 'grass'
  | 'fire'
  | 'water'
  | 'psychic'
  | 'electric'
  | 'dark'
  | 'steel'
  | 'dragon'
  | 'fighting'
  | 'ice'
  | 'poison'
  | 'normal'

/** Maps each Pokemon type to a CSS rgba glow color */
export const typeGlowColors: Record<PokemonType, string> = {
  grass:    'rgba(34, 197, 94, 0.75)',
  fire:     'rgba(239, 68, 68, 0.75)',
  water:    'rgba(56, 189, 248, 0.75)',
  psychic:  'rgba(192, 38, 211, 0.75)',
  electric: 'rgba(234, 179, 8, 0.75)',
  dark:     'rgba(99, 102, 241, 0.75)',
  steel:    'rgba(148, 163, 184, 0.75)',
  dragon:   'rgba(124, 58, 237, 0.75)',
  fighting: 'rgba(234, 88, 12, 0.75)',
  ice:      'rgba(103, 232, 249, 0.75)',
  poison:   'rgba(168, 85, 247, 0.75)',
  normal:   'rgba(161, 161, 170, 0.55)',
}

/** Keyword rules: first match wins. Order matters — more specific first. */
const TYPE_KEYWORD_RULES: Array<{ keywords: string[]; type: PokemonType }> = [
  { keywords: ['jungle', 'grass', 'leaf', 'forest', 'nature', 'garden', 'fern', 'verdant'], type: 'grass' },
  { keywords: ['fire', 'flame', 'volcanic', 'magma', 'inferno', 'blaze', 'combustion', 'charizard'], type: 'fire' },
  { keywords: ['water', 'ocean', 'sea', 'aqua', 'aquapolis', 'wave', 'tide', 'splash', 'marine', 'river'], type: 'water' },
  { keywords: ['psychic', 'mystic', 'mystery', 'ancient', 'arceus', 'legends', 'mythical', 'temporal', 'spatial'], type: 'psychic' },
  { keywords: ['electric', 'thunder', 'lightning', 'volt', 'spark', 'storm', 'tornado', 'pikachu'], type: 'electric' },
  { keywords: ['rocket', 'shadow', 'darkness', 'dark', 'night', 'cipher', 'sinister', 'neo destiny'], type: 'dark' },
  { keywords: ['steel', 'metal', 'iron', 'chrome', 'silver'], type: 'steel' },
  { keywords: ['dragon', 'draconid', 'roaring', 'rising'], type: 'dragon' },
  { keywords: ['fighting', 'combat', 'battle', 'warrior', 'champion'], type: 'fighting' },
  { keywords: ['ice', 'snow', 'frost', 'frozen', 'blizzard', 'glacier'], type: 'ice' },
  { keywords: ['poison', 'toxic', 'swamp', 'miasma'], type: 'poison' },
]

/** Palette used for the deterministic hash fallback (excludes 'normal') */
const FALLBACK_PALETTE: PokemonType[] = [
  'grass', 'fire', 'water', 'psychic', 'electric',
  'dark', 'dragon', 'fighting', 'ice', 'steel', 'poison',
]

/** Simple djb2-style hash of a string → stable positive integer */
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
  }
  return Math.abs(h)
}

/**
 * Derives a Pokemon type for a set based on keyword matching in the set name
 * and series. Falls back to a deterministic hash of the set id so every set
 * always gets the same consistent color even without an explicit keyword match.
 */
export function getPokemonTypeForSet(set: PokemonSet): PokemonType {
  const haystack = `${set.name ?? ''} ${set.series ?? ''}`.toLowerCase()

  for (const rule of TYPE_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.type
    }
  }

  // Deterministic fallback: hash the set id and pick from the palette
  return FALLBACK_PALETTE[hashString(set.id) % FALLBACK_PALETTE.length]
}

/**
 * Maps the stored `type` column value from the cards table (e.g. "Grass",
 * "Lightning", "Darkness") to a normalised PokemonType used for UI colours.
 * The Pokemon TCG uses slightly different naming from the games:
 *   Lightning → electric  |  Darkness → dark  |  Metal → steel  |  Colorless → normal
 */
export function getPokemonTypeForCard(type: string | null | undefined): PokemonType {
  switch (type?.toLowerCase().trim()) {
    case 'grass':      return 'grass'
    case 'fire':       return 'fire'
    case 'water':      return 'water'
    case 'lightning':
    case 'electric':   return 'electric'
    case 'psychic':    return 'psychic'
    case 'darkness':
    case 'dark':       return 'dark'
    case 'metal':
    case 'steel':      return 'steel'
    case 'dragon':     return 'dragon'
    case 'fighting':   return 'fighting'
    case 'ice':        return 'ice'
    case 'poison':     return 'poison'
    case 'fairy':      return 'psychic'   // Fairy was retired in Sword & Shield era
    case 'colorless':
    case 'normal':
    default:           return 'normal'
  }
}