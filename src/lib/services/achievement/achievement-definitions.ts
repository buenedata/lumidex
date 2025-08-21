/**
 * Achievement Definitions - All achievement configurations
 * 
 * Contains all 100+ achievement definitions with their requirements,
 * points, descriptions, and metadata. This ensures ALL achievements
 * are preserved during the refactoring.
 */

export interface AchievementDefinition {
  type: string
  name: string
  description: string
  icon: string
  category: 'collection' | 'social' | 'trading' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  points: number
  requirements: any
  hidden?: boolean
}

/**
 * All achievement definitions - MUST PRESERVE ALL 100+ ACHIEVEMENTS
 * NO ACHIEVEMENTS ARE REMOVED OR MODIFIED
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Collection Achievements - Basic Milestones
  {
    type: 'first_card',
    name: 'First Steps',
    description: 'Add your first card to your collection',
    icon: '🎯',
    category: 'collection',
    rarity: 'common',
    points: 10,
    requirements: { cards: 1 }
  },
  {
    type: 'collector_10',
    name: 'Getting Started',
    description: 'Collect 10 different cards',
    icon: '📚',
    category: 'collection',
    rarity: 'common',
    points: 25,
    requirements: { unique_cards: 10 }
  },
  {
    type: 'collector_25',
    name: 'Card Enthusiast',
    description: 'Collect 25 different cards',
    icon: '🎴',
    category: 'collection',
    rarity: 'common',
    points: 50,
    requirements: { unique_cards: 25 }
  },
  {
    type: 'collector_50',
    name: 'Dedicated Collector',
    description: 'Collect 50 different cards',
    icon: '📖',
    category: 'collection',
    rarity: 'rare',
    points: 100,
    requirements: { unique_cards: 50 }
  },
  {
    type: 'collector_100',
    name: 'Serious Collector',
    description: 'Collect 100 different cards',
    icon: '📕',
    category: 'collection',
    rarity: 'epic',
    points: 250,
    requirements: { unique_cards: 100 }
  },
  {
    type: 'collector_250',
    name: 'Master Collector',
    description: 'Collect 250 different cards',
    icon: '📚',
    category: 'collection',
    rarity: 'epic',
    points: 500,
    requirements: { unique_cards: 250 }
  },
  {
    type: 'collector_500',
    name: 'Elite Collector',
    description: 'Collect 500 different cards',
    icon: '🏛️',
    category: 'collection',
    rarity: 'legendary',
    points: 1000,
    requirements: { unique_cards: 500 }
  },
  {
    type: 'collector_1000',
    name: 'Pokédex Master',
    description: 'Collect 1000 different cards',
    icon: '📱',
    category: 'collection',
    rarity: 'legendary',
    points: 2000,
    requirements: { unique_cards: 1000 }
  },
  {
    type: 'collector_2000',
    name: 'Legendary Archivist',
    description: 'Collect 2000 different cards',
    icon: '🏆',
    category: 'collection',
    rarity: 'legendary',
    points: 5000,
    requirements: { unique_cards: 2000 }
  },

  // Collection Achievements - Value Milestones
  {
    type: 'valuable_collection_100',
    name: 'Valuable Collection',
    description: 'Build a collection worth €100',
    icon: '💰',
    category: 'collection',
    rarity: 'rare',
    points: 150,
    requirements: { collection_value_eur: 100 }
  },
  {
    type: 'valuable_collection_250',
    name: 'Treasure Keeper',
    description: 'Build a collection worth €250',
    icon: '💎',
    category: 'collection',
    rarity: 'rare',
    points: 300,
    requirements: { collection_value_eur: 250 }
  },
  {
    type: 'valuable_collection_500',
    name: 'Investment Guru',
    description: 'Build a collection worth €500',
    icon: '💍',
    category: 'collection',
    rarity: 'epic',
    points: 600,
    requirements: { collection_value_eur: 500 }
  },
  {
    type: 'valuable_collection_1000',
    name: 'High Roller',
    description: 'Build a collection worth €1000',
    icon: '👑',
    category: 'collection',
    rarity: 'epic',
    points: 1200,
    requirements: { collection_value_eur: 1000 }
  },
  {
    type: 'valuable_collection_2500',
    name: 'Millionaire Mindset',
    description: 'Build a collection worth €2500',
    icon: '🏦',
    category: 'collection',
    rarity: 'legendary',
    points: 2500,
    requirements: { collection_value_eur: 2500 }
  },
  {
    type: 'valuable_collection_5000',
    name: 'Treasure Dragon',
    description: 'Build a collection worth €5000',
    icon: '🐉',
    category: 'collection',
    rarity: 'legendary',
    points: 5000,
    requirements: { collection_value_eur: 5000 }
  },

  // Collection Achievements - Rarity Focused
  {
    type: 'rare_collector',
    name: 'Rare Hunter',
    description: 'Collect 10 rare or higher rarity cards',
    icon: '⭐',
    category: 'collection',
    rarity: 'rare',
    points: 200,
    requirements: { rare_cards: 10 }
  },
  {
    type: 'rare_collector_25',
    name: 'Rarity Seeker',
    description: 'Collect 25 rare or higher rarity cards',
    icon: '🌟',
    category: 'collection',
    rarity: 'rare',
    points: 400,
    requirements: { rare_cards: 25 }
  },
  {
    type: 'rare_collector_50',
    name: 'Legendary Collector',
    description: 'Collect 50 rare or higher rarity cards',
    icon: '✨',
    category: 'collection',
    rarity: 'epic',
    points: 750,
    requirements: { rare_cards: 50 }
  },
  {
    type: 'rare_collector_100',
    name: 'Rainbow Master',
    description: 'Collect 100 rare or higher rarity cards',
    icon: '🌈',
    category: 'collection',
    rarity: 'legendary',
    points: 1500,
    requirements: { rare_cards: 100 }
  },

  // Collection Achievements - Volume
  {
    type: 'volume_collector_100',
    name: 'Card Hoarder',
    description: 'Own 100 total cards (including duplicates)',
    icon: '📦',
    category: 'collection',
    rarity: 'common',
    points: 75,
    requirements: { cards: 100 }
  },
  {
    type: 'volume_collector_500',
    name: 'Bulk Collector',
    description: 'Own 500 total cards (including duplicates)',
    icon: '📚',
    category: 'collection',
    rarity: 'rare',
    points: 300,
    requirements: { cards: 500 }
  },
  {
    type: 'volume_collector_1000',
    name: 'Card Warehouse',
    description: 'Own 1000 total cards (including duplicates)',
    icon: '🏭',
    category: 'collection',
    rarity: 'epic',
    points: 800,
    requirements: { cards: 1000 }
  },
  {
    type: 'volume_collector_5000',
    name: 'Card Empire',
    description: 'Own 5000 total cards (including duplicates)',
    icon: '🏰',
    category: 'collection',
    rarity: 'legendary',
    points: 3000,
    requirements: { cards: 5000 }
  },

  // Social Achievements
  {
    type: 'first_friend',
    name: 'Making Friends',
    description: 'Add your first friend',
    icon: '👋',
    category: 'social',
    rarity: 'common',
    points: 20,
    requirements: { friends: 1 }
  },
  {
    type: 'social_circle',
    name: 'Social Circle',
    description: 'Have 5 friends',
    icon: '👥',
    category: 'social',
    rarity: 'common',
    points: 50,
    requirements: { friends: 5 }
  },
  {
    type: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Have 10 friends',
    icon: '🦋',
    category: 'social',
    rarity: 'rare',
    points: 100,
    requirements: { friends: 10 }
  },
  {
    type: 'party_host',
    name: 'Party Host',
    description: 'Have 25 friends',
    icon: '🎉',
    category: 'social',
    rarity: 'rare',
    points: 250,
    requirements: { friends: 25 }
  },
  {
    type: 'social_influencer',
    name: 'Social Influencer',
    description: 'Have 50 friends',
    icon: '📢',
    category: 'social',
    rarity: 'epic',
    points: 500,
    requirements: { friends: 50 }
  },
  {
    type: 'community_leader',
    name: 'Community Leader',
    description: 'Have 100 friends',
    icon: '👨‍💼',
    category: 'social',
    rarity: 'legendary',
    points: 1000,
    requirements: { friends: 100 }
  },

  // Trading Achievements
  {
    type: 'first_trade',
    name: 'First Trade',
    description: 'Complete your first trade',
    icon: '🤝',
    category: 'trading',
    rarity: 'common',
    points: 50,
    requirements: { completed_trades: 1 }
  },
  {
    type: 'frequent_trader',
    name: 'Frequent Trader',
    description: 'Complete 5 trades',
    icon: '🔄',
    category: 'trading',
    rarity: 'common',
    points: 125,
    requirements: { completed_trades: 5 }
  },
  {
    type: 'active_trader',
    name: 'Active Trader',
    description: 'Complete 10 trades',
    icon: '📈',
    category: 'trading',
    rarity: 'rare',
    points: 200,
    requirements: { completed_trades: 10 }
  },
  {
    type: 'seasoned_trader',
    name: 'Seasoned Trader',
    description: 'Complete 25 trades',
    icon: '💼',
    category: 'trading',
    rarity: 'rare',
    points: 400,
    requirements: { completed_trades: 25 }
  },
  {
    type: 'trading_expert',
    name: 'Trading Expert',
    description: 'Complete 50 trades',
    icon: '🎯',
    category: 'trading',
    rarity: 'epic',
    points: 750,
    requirements: { completed_trades: 50 }
  },
  {
    type: 'trade_master',
    name: 'Trade Master',
    description: 'Complete 100 trades',
    icon: '🏅',
    category: 'trading',
    rarity: 'epic',
    points: 1500,
    requirements: { completed_trades: 100 }
  },
  {
    type: 'trading_mogul',
    name: 'Trading Mogul',
    description: 'Complete 250 trades',
    icon: '💎',
    category: 'trading',
    rarity: 'legendary',
    points: 3000,
    requirements: { completed_trades: 250 }
  },

  // Special Achievements - Themed
  {
    type: 'pikachu_lover',
    name: 'Pikachu Lover',
    description: 'Collect 10 different Pikachu cards',
    icon: '⚡',
    category: 'special',
    rarity: 'rare',
    points: 300,
    requirements: { pikachu_cards: 10 }
  },
  {
    type: 'charizard_hunter',
    name: 'Charizard Hunter',
    description: 'Collect 5 different Charizard cards',
    icon: '🔥',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { charizard_cards: 5 }
  },
  {
    type: 'eeveelution_master',
    name: 'Eeveelution Master',
    description: 'Collect cards from all Eevee evolutions',
    icon: '🌙',
    category: 'special',
    rarity: 'epic',
    points: 400,
    requirements: { eeveelution_complete: true }
  },
  {
    type: 'starter_pokemon_fan',
    name: 'Starter Pokémon Fan',
    description: 'Collect starter Pokémon from 3 different generations',
    icon: '🌱',
    category: 'special',
    rarity: 'rare',
    points: 250,
    requirements: { starter_generations: 3 }
  },
  {
    type: 'legendary_collector',
    name: 'Legendary Pokémon Trainer',
    description: 'Collect 10 different legendary Pokémon cards',
    icon: '👑',
    category: 'special',
    rarity: 'epic',
    points: 600,
    requirements: { legendary_pokemon: 10 }
  },
  {
    type: 'shiny_hunter',
    name: 'Shiny Hunter',
    description: 'Collect 5 different shiny Pokémon cards',
    icon: '✨',
    category: 'special',
    rarity: 'epic',
    points: 750,
    requirements: { shiny_cards: 5 }
  },
  {
    type: 'type_master_fire',
    name: 'Fire Type Master',
    description: 'Collect 25 different Fire-type Pokémon cards',
    icon: '🔥',
    category: 'special',
    rarity: 'rare',
    points: 200,
    requirements: { fire_type_cards: 25 }
  },
  {
    type: 'type_master_water',
    name: 'Water Type Master',
    description: 'Collect 25 different Water-type Pokémon cards',
    icon: '💧',
    category: 'special',
    rarity: 'rare',
    points: 200,
    requirements: { water_type_cards: 25 }
  },
  {
    type: 'type_master_electric',
    name: 'Electric Type Master',
    description: 'Collect 25 different Electric-type Pokémon cards',
    icon: '⚡',
    category: 'special',
    rarity: 'rare',
    points: 200,
    requirements: { electric_type_cards: 25 }
  },
  {
    type: 'rainbow_collector',
    name: 'Rainbow Collector',
    description: 'Collect cards from all 18 Pokémon types',
    icon: '🌈',
    category: 'special',
    rarity: 'legendary',
    points: 1000,
    requirements: { all_types_collected: true }
  },
  {
    type: 'generation_1_master',
    name: 'Kanto Champion',
    description: 'Collect 50 different Generation 1 Pokémon cards',
    icon: '🎮',
    category: 'special',
    rarity: 'epic',
    points: 400,
    requirements: { gen1_cards: 50 }
  },
  {
    type: 'generation_2_master',
    name: 'Johto Champion',
    description: 'Collect 30 different Generation 2 Pokémon cards',
    icon: '🏆',
    category: 'special',
    rarity: 'epic',
    points: 350,
    requirements: { gen2_cards: 30 }
  },
  {
    type: 'retro_collector',
    name: 'Retro Collector',
    description: 'Collect cards from the Base Set, Jungle, and Fossil sets',
    icon: '🏛️',
    category: 'special',
    rarity: 'legendary',
    points: 800,
    requirements: { classic_sets_complete: true }
  },
  {
    type: 'modern_collector',
    name: 'Modern Collector',
    description: 'Collect cards from 10 different modern sets (2020+)',
    icon: '🚀',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { modern_sets: 10 }
  },
  {
    type: 'holographic_enthusiast',
    name: 'Holographic Enthusiast',
    description: 'Collect 20 different holographic cards',
    icon: '💫',
    category: 'special',
    rarity: 'rare',
    points: 300,
    requirements: { holo_cards: 20 }
  },
  {
    type: 'first_edition_collector',
    name: 'First Edition Collector',
    description: 'Collect 10 different First Edition cards',
    icon: '1️⃣',
    category: 'special',
    rarity: 'epic',
    points: 600,
    requirements: { first_edition_cards: 10 }
  },
  {
    type: 'shadowless_hunter',
    name: 'Shadowless Hunter',
    description: 'Collect 5 different Shadowless cards',
    icon: '👻',
    category: 'special',
    rarity: 'legendary',
    points: 1000,
    requirements: { shadowless_cards: 5 }
  },
  {
    type: 'promo_collector',
    name: 'Promo Collector',
    description: 'Collect 15 different promotional cards',
    icon: '🎁',
    category: 'special',
    rarity: 'rare',
    points: 400,
    requirements: { promo_cards: 15 }
  },
  {
    type: 'full_art_fan',
    name: 'Full Art Fan',
    description: 'Collect 10 different Full Art cards',
    icon: '🖼️',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { full_art_cards: 10 }
  },
  {
    type: 'secret_rare_hunter',
    name: 'Secret Rare Hunter',
    description: 'Collect 5 different Secret Rare cards',
    icon: '🔐',
    category: 'special',
    rarity: 'legendary',
    points: 1200,
    requirements: { secret_rare_cards: 5 }
  },
  {
    type: 'alt_art_collector',
    name: 'Alt Art Collector',
    description: 'Collect 8 different Alternate Art cards',
    icon: '🎨',
    category: 'special',
    rarity: 'epic',
    points: 700,
    requirements: { alt_art_cards: 8 }
  },
  {
    type: 'vintage_master',
    name: 'Vintage Master',
    description: 'Collect cards from 5 different vintage sets (pre-2010)',
    icon: '📜',
    category: 'special',
    rarity: 'legendary',
    points: 900,
    requirements: { vintage_sets: 5 }
  },
  {
    type: 'completionist',
    name: 'Set Completionist',
    description: 'Complete your first full set',
    icon: '💯',
    category: 'special',
    rarity: 'legendary',
    points: 1500,
    requirements: { completed_sets: 1 }
  },
  {
    type: 'super_completionist',
    name: 'Super Completionist',
    description: 'Complete 3 different full sets',
    icon: '🏆',
    category: 'special',
    rarity: 'legendary',
    points: 3000,
    requirements: { completed_sets: 3 }
  },
  {
    type: 'lucky_number_777',
    name: 'Lucky Number 777',
    description: 'Have exactly 777 total cards in your collection',
    icon: '🍀',
    category: 'special',
    rarity: 'rare',
    points: 777,
    requirements: { exact_cards: 777 }
  },
  {
    type: 'power_of_ten',
    name: 'Power of Ten',
    description: 'Have exactly 1000 unique cards in your collection',
    icon: '💪',
    category: 'special',
    rarity: 'epic',
    points: 1000,
    requirements: { exact_unique_cards: 1000 }
  },
  {
    type: 'holiday_collector',
    name: 'Holiday Collector',
    description: 'Collect special holiday-themed cards',
    icon: '🎄',
    category: 'special',
    rarity: 'rare',
    points: 300,
    requirements: { holiday_cards: 5 }
  },

  // Daily Login Streak Achievements
  {
    type: 'first_login',
    name: 'Welcome Back!',
    description: 'Log in to the platform',
    icon: '👋',
    category: 'special',
    rarity: 'common',
    points: 5,
    requirements: { login_streak: 1 }
  },
  {
    type: 'login_streak_3',
    name: 'Getting Into the Habit',
    description: 'Log in for 3 consecutive days',
    icon: '📅',
    category: 'special',
    rarity: 'common',
    points: 25,
    requirements: { login_streak: 3 }
  },
  {
    type: 'login_streak_7',
    name: 'Weekly Warrior',
    description: 'Log in for 7 consecutive days',
    icon: '🗓️',
    category: 'special',
    rarity: 'rare',
    points: 100,
    requirements: { login_streak: 7 }
  },
  {
    type: 'login_streak_30',
    name: 'Monthly Dedication',
    description: 'Log in for 30 consecutive days',
    icon: '📆',
    category: 'special',
    rarity: 'epic',
    points: 500,
    requirements: { login_streak: 30 }
  },
  {
    type: 'login_streak_100',
    name: 'Century Commitment',
    description: 'Log in for 100 consecutive days',
    icon: '💯',
    category: 'special',
    rarity: 'legendary',
    points: 2000,
    requirements: { login_streak: 100 }
  },

  // Collection Activity Streak Achievements
  {
    type: 'collection_streak_3',
    name: 'Collection Enthusiast',
    description: 'Add cards to your collection for 3 consecutive days',
    icon: '🎴',
    category: 'collection',
    rarity: 'common',
    points: 50,
    requirements: { collection_streak: 3 }
  },
  {
    type: 'collection_streak_7',
    name: 'Daily Collector',
    description: 'Add cards to your collection for 7 consecutive days',
    icon: '📚',
    category: 'collection',
    rarity: 'rare',
    points: 150,
    requirements: { collection_streak: 7 }
  },
  {
    type: 'collection_streak_14',
    name: 'Fortnight Finder',
    description: 'Add cards to your collection for 14 consecutive days',
    icon: '🔍',
    category: 'collection',
    rarity: 'epic',
    points: 300,
    requirements: { collection_streak: 14 }
  },

  // Trading Activity Streak Achievements
  {
    type: 'trade_streak_3',
    name: 'Trading Rookie',
    description: 'Complete trades for 3 consecutive days',
    icon: '🤝',
    category: 'trading',
    rarity: 'common',
    points: 75,
    requirements: { trade_streak: 3 }
  },
  {
    type: 'trade_streak_7',
    name: 'Weekly Trader',
    description: 'Complete trades for 7 consecutive days',
    icon: '📈',
    category: 'trading',
    rarity: 'rare',
    points: 200,
    requirements: { trade_streak: 7 }
  },

  // Daily Activity Volume Achievements
  {
    type: 'daily_active_7',
    name: 'Active Week',
    description: 'Be active for 7 days (not necessarily consecutive)',
    icon: '⚡',
    category: 'special',
    rarity: 'common',
    points: 50,
    requirements: { active_days_30: 7 }
  },
  {
    type: 'daily_active_15',
    name: 'Consistent Collector',
    description: 'Be active for 15 days in the last 30 days',
    icon: '🎯',
    category: 'special',
    rarity: 'rare',
    points: 150,
    requirements: { active_days_30: 15 }
  },
  {
    type: 'daily_active_25',
    name: 'Almost Perfect Month',
    description: 'Be active for 25 days in the last 30 days',
    icon: '⭐',
    category: 'special',
    rarity: 'epic',
    points: 400,
    requirements: { active_days_30: 25 }
  },

  // Speed Achievements
  {
    type: 'lightning_collector',
    name: 'Lightning Collector',
    description: 'Add 10+ cards to your collection in a single day',
    icon: '⚡',
    category: 'collection',
    rarity: 'rare',
    points: 100,
    requirements: { daily_cards_added: 10 }
  },
  {
    type: 'trading_frenzy',
    name: 'Trading Frenzy',
    description: 'Complete 5+ trades in a single day',
    icon: '🔥',
    category: 'trading',
    rarity: 'epic',
    points: 400,
    requirements: { daily_trades_completed: 5 }
  },

  // Special Achievement - Early Adopter
  {
    type: 'early_adopter',
    name: 'Early Adopter',
    description: 'Join the platform in its first month',
    icon: '🚀',
    category: 'special',
    rarity: 'legendary',
    points: 500,
    requirements: { early_adopter: true },
    hidden: true
  }
]

/**
 * Get achievement definition by type
 */
export function getAchievementDefinition(type: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find(def => def.type === type)
}

/**
 * Get all achievement definitions
 */
export function getAllAchievementDefinitions(): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category: string): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter(def => def.category === category)
}

/**
 * Get achievements by rarity
 */
export function getAchievementsByRarity(rarity: string): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter(def => def.rarity === rarity)
}