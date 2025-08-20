-- Streak and Daily Activity Achievement Definitions
-- Add these achievements to the ACHIEVEMENT_DEFINITIONS array in src/lib/achievement-service.ts

/*
Daily Login Streak Achievements:
*/

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
{
  type: 'login_streak_365',
  name: 'Annual Achiever',
  description: 'Log in for 365 consecutive days',
  icon: '🏆',
  category: 'special',
  rarity: 'legendary',
  points: 10000,
  requirements: { login_streak: 365 }
},

/*
Collection Activity Streak Achievements:
*/

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
{
  type: 'collection_streak_30',
  name: 'Monthly Collector',
  description: 'Add cards to your collection for 30 consecutive days',
  icon: '📖',
  category: 'collection',
  rarity: 'legendary',
  points: 1000,
  requirements: { collection_streak: 30 }
},

/*
Trading Activity Streak Achievements:
*/

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
{
  type: 'trade_streak_14',
  name: 'Trade Professional',
  description: 'Complete trades for 14 consecutive days',
  icon: '💼',
  category: 'trading',
  rarity: 'epic',
  points: 500,
  requirements: { trade_streak: 14 }
},

/*
Daily Activity Volume Achievements:
*/

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
{
  type: 'daily_active_30',
  name: 'Perfect Month',
  description: 'Be active every single day in the last 30 days',
  icon: '🌟',
  category: 'special',
  rarity: 'legendary',
  points: 1000,
  requirements: { active_days_30: 30 }
},

/*
Weekend Warrior Achievements:
*/

{
  type: 'weekend_warrior_4',
  name: 'Weekend Warrior',
  description: 'Be active for 4 consecutive weekends',
  icon: '🏃',
  category: 'special',
  rarity: 'rare',
  points: 200,
  requirements: { weekend_streak: 4 }
},
{
  type: 'weekend_warrior_8',
  name: 'Weekend Champion',
  description: 'Be active for 8 consecutive weekends',
  icon: '🏆',
  category: 'special',
  rarity: 'epic',
  points: 500,
  requirements: { weekend_streak: 8 }
},

/*
Early Bird / Night Owl Achievements:
*/

{
  type: 'early_bird',
  name: 'Early Bird',
  description: 'Log in before 8 AM for 7 consecutive days',
  icon: '🌅',
  category: 'special',
  rarity: 'rare',
  points: 150,
  requirements: { early_bird_streak: 7 }
},
{
  type: 'night_owl',
  name: 'Night Owl',
  description: 'Log in after 10 PM for 7 consecutive days',
  icon: '🦉',
  category: 'special',
  rarity: 'rare',
  points: 150,
  requirements: { night_owl_streak: 7 }
},

/*
Milestone Comeback Achievements:
*/

{
  type: 'comeback_kid',
  name: 'Comeback Kid',
  description: 'Return after being inactive for 30+ days',
  icon: '🔄',
  category: 'special',
  rarity: 'rare',
  points: 100,
  requirements: { comeback_30_days: true }
},
{
  type: 'long_lost_collector',
  name: 'Long Lost Collector',
  description: 'Return after being inactive for 100+ days',
  icon: '🕰️',
  category: 'special',
  rarity: 'epic',
  points: 300,
  requirements: { comeback_100_days: true }
},

/*
Seasonal Activity Achievements:
*/

{
  type: 'spring_collector',
  name: 'Spring Collector',
  description: 'Be active every day during spring (March-May)',
  icon: '🌸',
  category: 'special',
  rarity: 'epic',
  points: 500,
  requirements: { spring_perfect: true }
},
{
  type: 'summer_trader',
  name: 'Summer Trader',
  description: 'Complete at least one trade every day during summer (June-August)',
  icon: '☀️',
  category: 'special',
  rarity: 'epic',
  points: 500,
  requirements: { summer_trade_perfect: true }
},
{
  type: 'autumn_collector',
  name: 'Autumn Collector',
  description: 'Add cards to collection every day during autumn (September-November)',
  icon: '🍂',
  category: 'special',
  rarity: 'epic',
  points: 500,
  requirements: { autumn_collection_perfect: true }
},
{
  type: 'winter_warrior',
  name: 'Winter Warrior',
  description: 'Be active every day during winter (December-February)',
  icon: '❄️',
  category: 'special',
  rarity: 'epic',
  points: 500,
  requirements: { winter_perfect: true }
},

/*
Speed Achievements:
*/

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
  type: 'card_tornado',
  name: 'Card Tornado',
  description: 'Add 25+ cards to your collection in a single day',
  icon: '🌪️',
  category: 'collection',
  rarity: 'epic',
  points: 300,
  requirements: { daily_cards_added: 25 }
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
}

/*
Note: These achievements require the following additional stats to be tracked in getUserStats():
- login_streak: Current consecutive login days
- collection_streak: Current consecutive days adding cards
- trade_streak: Current consecutive days completing trades
- active_days_30: Number of active days in last 30 days
- weekend_streak: Current consecutive weekends active
- early_bird_streak: Current consecutive early morning logins
- night_owl_streak: Current consecutive late night logins
- comeback_30_days: Boolean if user returned after 30+ day absence
- comeback_100_days: Boolean if user returned after 100+ day absence
- spring_perfect: Boolean if active every day in spring
- summer_trade_perfect: Boolean if traded every day in summer
- autumn_collection_perfect: Boolean if collected every day in autumn
- winter_perfect: Boolean if active every day in winter
- daily_cards_added: Number of cards added today
- daily_trades_completed: Number of trades completed today
*/