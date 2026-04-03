import { RawPricePoint, NormalizedPricePoint } from './types';

// Static exchange rates (USD = 1.0)
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.09,   // EUR → USD
  GBP: 1.27,
  JPY: 0.0067,
  CAD: 0.74,
  AUD: 0.65,
};

/**
 * Convert a price in any currency to USD
 */
export function toUsd(price: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency.toUpperCase()] ?? 1.0;
  return Math.round(price * rate * 100) / 100;
}

/**
 * Remove statistical outliers using IQR method
 * Returns cleaned array with extreme values removed
 */
export function removeOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices;

  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  return sorted.filter(p => p >= lower && p <= upper);
}

/**
 * Compute average of an array of numbers
 */
export function average(prices: number[]): number | null {
  if (!prices.length) return null;
  return Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
}

/**
 * Compute median of an array of numbers
 */
export function median(prices: number[]): number | null {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const result = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return Math.round(result * 100) / 100;
}

/**
 * Normalize a raw price point to USD
 */
export function normalizePoint(point: RawPricePoint): NormalizedPricePoint {
  return {
    ...point,
    priceUsd: toUsd(point.price, point.currency),
  };
}

/**
 * Normalize an array of raw price points
 */
export function normalizePoints(points: RawPricePoint[]): NormalizedPricePoint[] {
  return points.map(normalizePoint);
}
