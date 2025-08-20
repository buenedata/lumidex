/**
 * Price validation and correction utilities
 * 
 * Ensures pricing data follows logical constraints:
 * - Low price <= Average price <= Trend price
 * - Validates both normal/holo and reverse holo variants
 * - Provides correction strategies for inconsistent data
 */

export interface PriceValidationResult {
  isValid: boolean
  errors: string[]
  correctedPrices?: PricingData
  warnings: string[]
}

export interface PricingData {
  // Normal/Holo variant pricing (shared fields)
  cardmarket_avg_sell_price?: number | null
  cardmarket_low_price?: number | null
  cardmarket_trend_price?: number | null
  
  // Reverse holo variant pricing (separate fields)
  cardmarket_reverse_holo_sell?: number | null
  cardmarket_reverse_holo_low?: number | null
  cardmarket_reverse_holo_trend?: number | null
  
  // TCGPlayer 1st Edition pricing (USD)
  tcgplayer_1st_edition_normal_market?: number | null
  tcgplayer_1st_edition_normal_low?: number | null
  tcgplayer_1st_edition_normal_mid?: number | null
  tcgplayer_1st_edition_holofoil_market?: number | null
  tcgplayer_1st_edition_holofoil_low?: number | null
  tcgplayer_1st_edition_holofoil_mid?: number | null
}

export interface ValidationOptions {
  correctInvalidPrices?: boolean
  allowNullValues?: boolean
  logIssues?: boolean
  cardId?: string
  cardName?: string
}

/**
 * Validates price consistency for a card variant
 */
function validateVariantPricing(
  low: number | null | undefined,
  average: number | null | undefined,
  trend: number | null | undefined,
  variantName: string,
  options: ValidationOptions = {}
): { isValid: boolean; errors: string[]; warnings: string[]; corrected?: { low: number | null; average: number | null; trend: number | null } } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Skip validation if all prices are null/undefined
  if (!low && !average && !trend) {
    return { isValid: true, errors, warnings }
  }
  
  // Convert undefined to null for consistency
  const cleanLow = low ?? null
  const cleanAverage = average ?? null
  const cleanTrend = trend ?? null
  
  // Track validation issues
  let hasLogicalErrors = false
  
  // Check: Low price should be <= Average price
  if (cleanLow !== null && cleanAverage !== null && cleanLow > cleanAverage) {
    errors.push(`${variantName}: Low price (${cleanLow}) is higher than average price (${cleanAverage})`)
    hasLogicalErrors = true
  }
  
  // Check: Average price vs Trend price (warning only for reasonable differences)
  if (cleanAverage !== null && cleanTrend !== null && cleanAverage > cleanTrend) {
    const ratio = cleanAverage / cleanTrend
    if (ratio > 2.0) {
      // Only treat as error if average is more than 2x the trend price
      errors.push(`${variantName}: Average price (${cleanAverage}) is unreasonably higher than trend price (${cleanTrend}) - ratio: ${ratio.toFixed(1)}x`)
      hasLogicalErrors = true
    } else {
      // Normal market fluctuation - just a warning
      warnings.push(`${variantName}: Average price (${cleanAverage}) is higher than trend price (${cleanTrend}) - this can be normal market behavior`)
    }
  }
  
  // Check: Low price vs Trend price (more lenient)
  if (cleanLow !== null && cleanTrend !== null && cleanLow > cleanTrend) {
    const ratio = cleanLow / cleanTrend
    if (ratio > 1.5) {
      // Only treat as error if low price is significantly higher than trend
      errors.push(`${variantName}: Low price (${cleanLow}) is significantly higher than trend price (${cleanTrend}) - ratio: ${ratio.toFixed(1)}x`)
      hasLogicalErrors = true
    } else {
      // Minor discrepancy - just a warning
      warnings.push(`${variantName}: Low price (${cleanLow}) is slightly higher than trend price (${cleanTrend}) - possible data timing issue`)
    }
  }
  
  // Check for unrealistic price differences (warnings only)
  if (cleanLow !== null && cleanAverage !== null) {
    const ratio = cleanAverage / cleanLow
    if (ratio > 10) {
      // Only warn for very large gaps (10x instead of 5x)
      warnings.push(`${variantName}: Very large price gap - average (${cleanAverage}) is ${ratio.toFixed(1)}x higher than low (${cleanLow})`)
    }
  }
  
  // Check for negative prices
  if (cleanLow !== null && cleanLow < 0) {
    errors.push(`${variantName}: Negative low price (${cleanLow})`)
    hasLogicalErrors = true
  }
  if (cleanAverage !== null && cleanAverage < 0) {
    errors.push(`${variantName}: Negative average price (${cleanAverage})`)
    hasLogicalErrors = true
  }
  if (cleanTrend !== null && cleanTrend < 0) {
    errors.push(`${variantName}: Negative trend price (${cleanTrend})`)
    hasLogicalErrors = true
  }
  
  // Attempt correction if requested and there are logical errors
  let corrected: { low: number | null; average: number | null; trend: number | null } | undefined
  
  if (hasLogicalErrors && options.correctInvalidPrices) {
    corrected = correctPricingLogic(cleanLow, cleanAverage, cleanTrend, variantName)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    corrected
  }
}

/**
 * Attempts to correct invalid pricing logic by applying heuristics
 */
function correctPricingLogic(
  low: number | null,
  average: number | null,
  trend: number | null,
  variantName: string
): { low: number | null; average: number | null; trend: number | null } {
  const values = [low, average, trend].filter(v => v !== null && v >= 0) as number[]
  
  if (values.length === 0) {
    return { low: null, average: null, trend: null }
  }
  
  if (values.length === 1) {
    // If we only have one valid price, use it for all fields
    const singlePrice = values[0]
    return { low: singlePrice, average: singlePrice, trend: singlePrice }
  }
  
  // Sort values to maintain logical order
  values.sort((a, b) => a - b)
  
  if (values.length === 2) {
    // Two values: assign lower to low, higher to average and trend
    return {
      low: values[0],
      average: values[1],
      trend: values[1]
    }
  }
  
  // Three values: assign in order
  return {
    low: values[0],
    average: values[1],
    trend: values[2]
  }
}

/**
 * Main validation function for card pricing data
 */
export function validateCardPricing(
  pricingData: PricingData,
  options: ValidationOptions = {}
): PriceValidationResult {
  const allErrors: string[] = []
  const allWarnings: string[] = []
  const correctedPrices: PricingData = { ...pricingData }
  
  // Validate Normal/Holo variants (shared CardMarket pricing fields only)
  const normalHoloResult = validateVariantPricing(
    pricingData.cardmarket_low_price,
    pricingData.cardmarket_avg_sell_price,
    pricingData.cardmarket_trend_price,
    'Normal/Holo', // Only Normal and Holo share CardMarket pricing
    options
  )
  
  allErrors.push(...normalHoloResult.errors)
  allWarnings.push(...normalHoloResult.warnings)
  
  if (normalHoloResult.corrected && options.correctInvalidPrices) {
    correctedPrices.cardmarket_low_price = normalHoloResult.corrected.low
    correctedPrices.cardmarket_avg_sell_price = normalHoloResult.corrected.average
    correctedPrices.cardmarket_trend_price = normalHoloResult.corrected.trend
  }
  
  // Validate reverse holo variant (separate pricing fields)
  const reverseHoloResult = validateVariantPricing(
    pricingData.cardmarket_reverse_holo_low,
    pricingData.cardmarket_reverse_holo_sell,
    pricingData.cardmarket_reverse_holo_trend,
    'Reverse Holo',
    options
  )
  
  allErrors.push(...reverseHoloResult.errors)
  allWarnings.push(...reverseHoloResult.warnings)
  
  if (reverseHoloResult.corrected && options.correctInvalidPrices) {
    correctedPrices.cardmarket_reverse_holo_low = reverseHoloResult.corrected.low
    correctedPrices.cardmarket_reverse_holo_sell = reverseHoloResult.corrected.average
    correctedPrices.cardmarket_reverse_holo_trend = reverseHoloResult.corrected.trend
  }
  
  // Validate TCGPlayer 1st Edition Normal variant
  const tcg1stNormalResult = validateVariantPricing(
    pricingData.tcgplayer_1st_edition_normal_low,
    pricingData.tcgplayer_1st_edition_normal_market,
    pricingData.tcgplayer_1st_edition_normal_mid,
    'TCGPlayer 1st Edition Normal',
    options
  )
  
  allErrors.push(...tcg1stNormalResult.errors)
  allWarnings.push(...tcg1stNormalResult.warnings)
  
  if (tcg1stNormalResult.corrected && options.correctInvalidPrices) {
    correctedPrices.tcgplayer_1st_edition_normal_low = tcg1stNormalResult.corrected.low
    correctedPrices.tcgplayer_1st_edition_normal_market = tcg1stNormalResult.corrected.average
    correctedPrices.tcgplayer_1st_edition_normal_mid = tcg1stNormalResult.corrected.trend
  }
  
  // Validate TCGPlayer 1st Edition Holo variant
  const tcg1stHoloResult = validateVariantPricing(
    pricingData.tcgplayer_1st_edition_holofoil_low,
    pricingData.tcgplayer_1st_edition_holofoil_market,
    pricingData.tcgplayer_1st_edition_holofoil_mid,
    'TCGPlayer 1st Edition Holo',
    options
  )
  
  allErrors.push(...tcg1stHoloResult.errors)
  allWarnings.push(...tcg1stHoloResult.warnings)
  
  if (tcg1stHoloResult.corrected && options.correctInvalidPrices) {
    correctedPrices.tcgplayer_1st_edition_holofoil_low = tcg1stHoloResult.corrected.low
    correctedPrices.tcgplayer_1st_edition_holofoil_market = tcg1stHoloResult.corrected.average
    correctedPrices.tcgplayer_1st_edition_holofoil_mid = tcg1stHoloResult.corrected.trend
  }
  
  // Log issues if requested
  if (options.logIssues && (allErrors.length > 0 || allWarnings.length > 0)) {
    const cardInfo = options.cardName 
      ? `${options.cardName} (${options.cardId})`
      : options.cardId || 'Unknown card'
    
    if (allErrors.length > 0) {
      console.warn(`💰 Price validation errors for ${cardInfo}:`, allErrors)
    }
    
    if (allWarnings.length > 0) {
      console.info(`💰 Price validation warnings for ${cardInfo}:`, allWarnings)
    }
  }
  
  const result: PriceValidationResult = {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  }
  
  if (options.correctInvalidPrices && allErrors.length > 0) {
    result.correctedPrices = correctedPrices
  }
  
  return result
}

/**
 * Utility function to validate and optionally correct pricing during data sync
 */
export function validateAndCorrectCardPricing(
  cardData: any,
  options: ValidationOptions = {}
): any {
  const pricingData: PricingData = {
    cardmarket_avg_sell_price: cardData.cardmarket_avg_sell_price,
    cardmarket_low_price: cardData.cardmarket_low_price,
    cardmarket_trend_price: cardData.cardmarket_trend_price,
    cardmarket_reverse_holo_sell: cardData.cardmarket_reverse_holo_sell,
    cardmarket_reverse_holo_low: cardData.cardmarket_reverse_holo_low,
    cardmarket_reverse_holo_trend: cardData.cardmarket_reverse_holo_trend,
    tcgplayer_1st_edition_normal_market: cardData.tcgplayer_1st_edition_normal_market,
    tcgplayer_1st_edition_normal_low: cardData.tcgplayer_1st_edition_normal_low,
    tcgplayer_1st_edition_normal_mid: cardData.tcgplayer_1st_edition_normal_mid,
    tcgplayer_1st_edition_holofoil_market: cardData.tcgplayer_1st_edition_holofoil_market,
    tcgplayer_1st_edition_holofoil_low: cardData.tcgplayer_1st_edition_holofoil_low,
    tcgplayer_1st_edition_holofoil_mid: cardData.tcgplayer_1st_edition_holofoil_mid,
  }
  
  const validationResult = validateCardPricing(pricingData, {
    ...options,
    correctInvalidPrices: true,
    logIssues: true,
    cardId: cardData.id,
    cardName: cardData.name
  })
  
  // Return corrected data if validation failed and corrections were made
  if (!validationResult.isValid && validationResult.correctedPrices) {
    return {
      ...cardData,
      ...validationResult.correctedPrices,
      // Add metadata about the correction
      price_validation_status: 'corrected',
      price_validation_errors: validationResult.errors,
      price_validation_warnings: validationResult.warnings,
      price_validation_timestamp: new Date().toISOString()
    }
  }
  
  // Add validation metadata even for valid prices
  return {
    ...cardData,
    price_validation_status: validationResult.isValid ? 'valid' : 'invalid',
    price_validation_errors: validationResult.errors,
    price_validation_warnings: validationResult.warnings,
    price_validation_timestamp: new Date().toISOString()
  }
}

/**
 * Quick validation function that returns a boolean
 */
export function isPricingValid(pricingData: PricingData): boolean {
  const result = validateCardPricing(pricingData, { logIssues: false })
  return result.isValid
}

/**
 * Utility to get validation summary for monitoring/debugging
 */
export function getPricingValidationSummary(pricingData: PricingData): {
  isValid: boolean
  errorCount: number
  warningCount: number
  summary: string
} {
  const result = validateCardPricing(pricingData, { logIssues: false })
  
  let summary = 'Valid pricing'
  if (!result.isValid) {
    summary = `${result.errors.length} error(s)`
    if (result.warnings.length > 0) {
      summary += `, ${result.warnings.length} warning(s)`
    }
  } else if (result.warnings.length > 0) {
    summary = `${result.warnings.length} warning(s)`
  }
  
  return {
    isValid: result.isValid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    summary
  }
}

/**
 * Utility to check if pricing data exists for any variant
 */
export function hasPricingData(pricingData: PricingData): boolean {
  return !!(
    pricingData.cardmarket_avg_sell_price ||
    pricingData.cardmarket_low_price ||
    pricingData.cardmarket_trend_price ||
    pricingData.cardmarket_reverse_holo_sell ||
    pricingData.cardmarket_reverse_holo_low ||
    pricingData.cardmarket_reverse_holo_trend
  )
}