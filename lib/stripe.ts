/**
 * Stripe client singleton — server-only.
 * NEVER import this file from Client Components or client-side code.
 * Only use in Route Handlers, Server Actions, and server utilities.
 */
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Match the API version configured in your Stripe Dashboard
  apiVersion: '2026-03-25.dahlia',
  typescript: true,
})

/** Price IDs from env — validated at startup so misconfiguration fails fast */
export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID!,
  annual:  process.env.STRIPE_ANNUAL_PRICE_ID!,
} as const

export type BillingPeriod = keyof typeof STRIPE_PRICES
