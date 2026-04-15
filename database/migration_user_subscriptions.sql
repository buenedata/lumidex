-- Migration: user_subscriptions
-- Tracks membership tier (free / pro) per user, with optional Stripe billing metadata.
-- A missing row for a given user_id is treated as free tier by the application.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier                    text        NOT NULL DEFAULT 'free'
                            CHECK (tier IN ('free', 'pro')),
  billing_period          text
                            CHECK (billing_period IN ('monthly', 'annual')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- One subscription row per user (upsert target)
  CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id)
);

-- ─── Index ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx
  ON public.user_subscriptions (user_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Only create the trigger if it doesn't already exist on this table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'user_subscriptions_updated_at'
      AND tgrelid = 'public.user_subscriptions'::regclass
  ) THEN
    CREATE TRIGGER user_subscriptions_updated_at
      BEFORE UPDATE ON public.user_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription tier
CREATE POLICY "Users can read their own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role (used by Stripe webhook handler + admin tools) can write
-- Users cannot modify their own tier directly — all writes go through the backend
CREATE POLICY "Service role can manage all subscriptions"
  ON public.user_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.user_subscriptions IS
  'One row per user. Missing row = free tier. Tier enforced at API layer via lib/subscription.ts.';

COMMENT ON COLUMN public.user_subscriptions.tier IS
  'free | pro. Application defaults to free when no row exists.';

COMMENT ON COLUMN public.user_subscriptions.billing_period IS
  'monthly = €4.99/mo | annual = €39.99/yr. NULL for manually-granted Pro access.';

COMMENT ON COLUMN public.user_subscriptions.current_period_end IS
  'When the current paid period ends. After this date, if not renewed, tier is reverted to free by the Stripe webhook handler.';
