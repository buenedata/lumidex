export type GameSlug = 'pokemon' | 'moomin';

export interface GameConfig {
  slug: GameSlug;
  displayName: string;
  cardBackImage: string;
  defaultLanguage: string;
}

export const GAMES: Record<GameSlug, GameConfig> = {
  pokemon: {
    slug: 'pokemon',
    displayName: 'Pokémon',
    cardBackImage: '/pokemon_card_backside.png',
    defaultLanguage: 'en',
  },
  moomin: {
    slug: 'moomin',
    displayName: 'Moomin',
    cardBackImage: '/moomin_card_backside.png',
    defaultLanguage: 'en',
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
