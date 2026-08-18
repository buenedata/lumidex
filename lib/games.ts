export type GameSlug = 'pokemon' | 'moomin' | 'mtg';

export interface GameConfig {
  slug: GameSlug;
  displayName: string;
  cardBackImage: string;
  defaultLanguage: string;
  /**
   * Logo/icon image for UI elements like the navbar dropdown.
   * Place the actual image files at the referenced paths under /public/.
   * e.g. public/images/games/pokemon-logo.png
   */
  logoUrl: string;
  /** Short description shown in game-picker UI */
  description?: string;
}

export const GAMES: Record<GameSlug, GameConfig> = {
  pokemon: {
    slug: 'pokemon',
    displayName: 'Pokémon',
    cardBackImage: '/pokemon_card_backside.png',
    defaultLanguage: 'en',
    logoUrl: '/images/games/pokemon-logo.png',
    description: 'The original TCG — collect every set from Base Set to Mega Evolution.',
  },
  moomin: {
    slug: 'moomin',
    displayName: 'Moomin',
    cardBackImage: '/moomin_card_backside.png',
    defaultLanguage: 'en',
    logoUrl: '/images/games/moomin-logo.jpg',
    description: 'Track your Moomin TCG collection.',
  },
  mtg: {
    slug: 'mtg',
    displayName: 'Magic: The Gathering',
    cardBackImage: '/mtg_card_backside.jpg',
    defaultLanguage: 'en',
    logoUrl: '/mtg_card_backside.jpg',
    description: 'Collect cards from every Magic: The Gathering set — from Alpha to the latest expansion.',
  },
};

export function getGameConfig(game: string): GameConfig {
  return GAMES[game as GameSlug] ?? GAMES.pokemon;
}

export function getCardBack(game: string): string {
  return getGameConfig(game).cardBackImage;
}

export function isValidGame(game: string): game is GameSlug {
  return game in GAMES;
}

export const ALL_GAME_SLUGS = Object.keys(GAMES) as GameSlug[];
