-- Migration: user_tiers public view
-- Exposes only (user_id, tier) from user_subscriptions to any authenticated user.
-- The Pro badge is a public-facing indicator, so making the tier column visible
-- to other authenticated users is intentional and safe.
--
-- Pattern mirrors the accepted_friends view. The view runs as SECURITY DEFINER
-- (security_invoker = false, the default) so it bypasses RLS on user_subscriptions,
-- allowing any authenticated user to look up any other user's tier via this view.
-- Sensitive Stripe columns (stripe_customer_id, stripe_subscription_id, etc.) are
-- NOT included in the view.

CREATE OR REPLACE VIEW public.user_tiers AS
  SELECT
    user_id,
    tier
  FROM public.user_subscriptions;

-- Grant read access to authenticated (and anon) roles so PostgREST can serve it
GRANT SELECT ON public.user_tiers TO authenticated;
GRANT SELECT ON public.user_tiers TO anon;
