/**
 * Achievement Checker - Requirements validation logic
 * 
 * Handles checking if achievement requirements are met based on user stats.
 * This preserves ALL achievement logic while separating concerns.
 */

import type { AchievementDefinition } from './achievement-definitions'

/**
 * Check if achievement requirements are met
 * PRESERVES ALL ORIGINAL LOGIC - NO CHANGES TO FUNCTIONALITY
 */
export function checkAchievementRequirements(definition: AchievementDefinition, stats: any): boolean {
  const req = definition.requirements

  // Collection achievements
  if (req.unique_cards && stats.unique_cards < req.unique_cards) return false
  if (req.cards && stats.total_cards < req.cards) return false
  if (req.collection_value_eur && stats.collection_value_eur < req.collection_value_eur) return false
  if (req.rare_cards && stats.rare_cards < req.rare_cards) return false

  // Social achievements
  if (req.friends && stats.friends < req.friends) return false

  // Trading achievements
  if (req.completed_trades && stats.completed_trades < req.completed_trades) return false

  // Special achievements - Pokemon specific
  if (req.pikachu_cards && stats.pikachu_cards < req.pikachu_cards) return false
  if (req.charizard_cards && stats.charizard_cards < req.charizard_cards) return false
  if (req.eeveelution_complete && !stats.eeveelution_complete) return false
  if (req.legendary_pokemon && stats.legendary_pokemon < req.legendary_pokemon) return false
  if (req.shiny_cards && stats.shiny_cards < req.shiny_cards) return false
  if (req.starter_generations && stats.starter_generations < req.starter_generations) return false

  // Type-based achievements
  if (req.fire_type_cards && stats.fire_type_cards < req.fire_type_cards) return false
  if (req.water_type_cards && stats.water_type_cards < req.water_type_cards) return false
  if (req.electric_type_cards && stats.electric_type_cards < req.electric_type_cards) return false
  if (req.all_types_collected && !stats.all_types_collected) return false

  // Generation-based achievements
  if (req.gen1_cards && stats.gen1_cards < req.gen1_cards) return false
  if (req.gen2_cards && stats.gen2_cards < req.gen2_cards) return false

  // Rarity and variant achievements
  if (req.holo_cards && stats.holo_cards < req.holo_cards) return false
  if (req.first_edition_cards && stats.first_edition_cards < req.first_edition_cards) return false
  if (req.secret_rare_cards && stats.secret_rare_cards < req.secret_rare_cards) return false
  if (req.full_art_cards && stats.full_art_cards < req.full_art_cards) return false
  if (req.alt_art_cards && stats.alt_art_cards < req.alt_art_cards) return false
  if (req.shadowless_cards && stats.shadowless_cards < req.shadowless_cards) return false

  // Set-based achievements
  if (req.modern_sets && stats.modern_sets < req.modern_sets) return false
  if (req.vintage_sets && stats.vintage_sets < req.vintage_sets) return false
  if (req.classic_sets_complete && !stats.classic_sets_complete) return false
  if (req.completed_sets && stats.completed_sets < req.completed_sets) return false

  // Special card types
  if (req.promo_cards && stats.promo_cards < req.promo_cards) return false
  if (req.holiday_cards && stats.holiday_cards < req.holiday_cards) return false

  // Exact number achievements
  if (req.exact_cards && stats.exact_cards !== req.exact_cards) return false
  if (req.exact_unique_cards && stats.exact_unique_cards !== req.exact_unique_cards) return false

  // Streak achievements
  if (req.login_streak && stats.login_streak < req.login_streak) return false
  if (req.collection_streak && stats.collection_streak < req.collection_streak) return false
  if (req.trade_streak && stats.trade_streak < req.trade_streak) return false

  // Daily activity achievements
  if (req.active_days_30 && stats.active_days_30 < req.active_days_30) return false
  if (req.daily_cards_added && stats.daily_cards_added < req.daily_cards_added) return false
  if (req.daily_trades_completed && stats.daily_trades_completed < req.daily_trades_completed) return false

  // Early adopter
  if (req.early_adopter && !stats.early_adopter) return false

  return true
}

/**
 * Get current progress value for an achievement
 * PRESERVES ALL ORIGINAL LOGIC - NO CHANGES TO FUNCTIONALITY
 */
export function getCurrentProgress(definition: AchievementDefinition, stats: any, isUnlocked: boolean = false): number {
  const req = definition.requirements
  let currentValue = 0

  // Collection achievements
  if (req.unique_cards) currentValue = stats.unique_cards
  else if (req.cards) currentValue = stats.total_cards
  else if (req.collection_value_eur) currentValue = stats.collection_value_eur
  else if (req.rare_cards) currentValue = stats.rare_cards
  
  // Social achievements
  else if (req.friends) currentValue = stats.friends
  
  // Trading achievements
  else if (req.completed_trades) currentValue = stats.completed_trades
  
  // Pokemon-specific achievements
  else if (req.pikachu_cards) currentValue = stats.pikachu_cards
  else if (req.charizard_cards) currentValue = stats.charizard_cards
  else if (req.legendary_pokemon) currentValue = stats.legendary_pokemon
  else if (req.shiny_cards) currentValue = stats.shiny_cards
  else if (req.starter_generations) currentValue = stats.starter_generations
  
  // Type-based achievements
  else if (req.fire_type_cards) currentValue = stats.fire_type_cards
  else if (req.water_type_cards) currentValue = stats.water_type_cards
  else if (req.electric_type_cards) currentValue = stats.electric_type_cards
  
  // Generation-based achievements
  else if (req.gen1_cards) currentValue = stats.gen1_cards
  else if (req.gen2_cards) currentValue = stats.gen2_cards
  
  // Rarity and variant achievements
  else if (req.holo_cards) currentValue = stats.holo_cards
  else if (req.first_edition_cards) currentValue = stats.first_edition_cards
  else if (req.secret_rare_cards) currentValue = stats.secret_rare_cards
  else if (req.full_art_cards) currentValue = stats.full_art_cards
  else if (req.alt_art_cards) currentValue = stats.alt_art_cards
  else if (req.shadowless_cards) currentValue = stats.shadowless_cards
  
  // Set-based achievements
  else if (req.modern_sets) currentValue = stats.modern_sets
  else if (req.vintage_sets) currentValue = stats.vintage_sets
  else if (req.completed_sets) currentValue = stats.completed_sets
  
  // Special card types
  else if (req.promo_cards) currentValue = stats.promo_cards
  else if (req.holiday_cards) currentValue = stats.holiday_cards
  
  // Exact number achievements
  else if (req.exact_cards) currentValue = stats.exact_cards
  else if (req.exact_unique_cards) currentValue = stats.exact_unique_cards
  
  // Streak achievements
  else if (req.login_streak) currentValue = stats.login_streak
  else if (req.collection_streak) currentValue = stats.collection_streak
  else if (req.trade_streak) currentValue = stats.trade_streak
  
  // Daily activity achievements
  else if (req.active_days_30) currentValue = stats.active_days_30
  else if (req.daily_cards_added) currentValue = stats.daily_cards_added
  else if (req.daily_trades_completed) currentValue = stats.daily_trades_completed
  
  // Boolean achievements (show as 0 or 1)
  else if (req.eeveelution_complete !== undefined) currentValue = stats.eeveelution_complete ? 1 : 0
  else if (req.all_types_collected !== undefined) currentValue = stats.all_types_collected ? 1 : 0
  else if (req.classic_sets_complete !== undefined) currentValue = stats.classic_sets_complete ? 1 : 0
  else if (req.early_adopter !== undefined) currentValue = stats.early_adopter ? 1 : 0

  // If achievement is unlocked, cap the display at the required value
  // This prevents showing values like "378.02/100" and shows "100/100" instead
  if (isUnlocked) {
    const requiredValue = getRequiredProgress(definition)
    return requiredValue // Show exactly the required amount for unlocked achievements
  }

  return Math.max(0, currentValue) // Ensure we don't show negative values
}

/**
 * Get required progress value for an achievement
 * PRESERVES ALL ORIGINAL LOGIC - NO CHANGES TO FUNCTIONALITY
 */
export function getRequiredProgress(definition: AchievementDefinition): number {
  const req = definition.requirements

  // Collection achievements
  if (req.unique_cards) return req.unique_cards
  if (req.cards) return req.cards
  if (req.collection_value_eur) return req.collection_value_eur
  if (req.rare_cards) return req.rare_cards
  
  // Social achievements
  if (req.friends) return req.friends
  
  // Trading achievements
  if (req.completed_trades) return req.completed_trades
  
  // Pokemon-specific achievements
  if (req.pikachu_cards) return req.pikachu_cards
  if (req.charizard_cards) return req.charizard_cards
  if (req.legendary_pokemon) return req.legendary_pokemon
  if (req.shiny_cards) return req.shiny_cards
  if (req.starter_generations) return req.starter_generations
  
  // Type-based achievements
  if (req.fire_type_cards) return req.fire_type_cards
  if (req.water_type_cards) return req.water_type_cards
  if (req.electric_type_cards) return req.electric_type_cards
  
  // Generation-based achievements
  if (req.gen1_cards) return req.gen1_cards
  if (req.gen2_cards) return req.gen2_cards
  
  // Rarity and variant achievements
  if (req.holo_cards) return req.holo_cards
  if (req.first_edition_cards) return req.first_edition_cards
  if (req.secret_rare_cards) return req.secret_rare_cards
  if (req.full_art_cards) return req.full_art_cards
  if (req.alt_art_cards) return req.alt_art_cards
  if (req.shadowless_cards) return req.shadowless_cards
  
  // Set-based achievements
  if (req.modern_sets) return req.modern_sets
  if (req.vintage_sets) return req.vintage_sets
  if (req.completed_sets) return req.completed_sets
  
  // Special card types
  if (req.promo_cards) return req.promo_cards
  if (req.holiday_cards) return req.holiday_cards
  
  // Exact number achievements
  if (req.exact_cards) return req.exact_cards
  if (req.exact_unique_cards) return req.exact_unique_cards
  
  // Streak achievements
  if (req.login_streak) return req.login_streak
  if (req.collection_streak) return req.collection_streak
  if (req.trade_streak) return req.trade_streak
  
  // Daily activity achievements
  if (req.active_days_30) return req.active_days_30
  if (req.daily_cards_added) return req.daily_cards_added
  if (req.daily_trades_completed) return req.daily_trades_completed

  // Boolean achievements always require 1
  return 1
}