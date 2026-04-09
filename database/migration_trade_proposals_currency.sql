-- ============================================================
-- Lumidex — Trade Proposals Currency Migration
-- Adds cash amounts + currency code to trade_proposals so
-- users can include or request money alongside (or instead of) cards.
-- Run once in Supabase SQL editor.
-- ============================================================

ALTER TABLE public.trade_proposals
  ADD COLUMN IF NOT EXISTS cash_offered   numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_requested numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency_code  text          NOT NULL DEFAULT 'EUR';

-- Optional: constrain currency_code to known ISO codes
ALTER TABLE public.trade_proposals
  DROP CONSTRAINT IF EXISTS trade_proposals_currency_code_check;

ALTER TABLE public.trade_proposals
  ADD CONSTRAINT trade_proposals_currency_code_check
  CHECK (currency_code IN ('EUR','USD','GBP','NOK','SEK','DKK','CAD','AUD','JPY','CHF'));

-- Non-negative cash amounts
ALTER TABLE public.trade_proposals
  DROP CONSTRAINT IF EXISTS trade_proposals_cash_offered_check;
ALTER TABLE public.trade_proposals
  ADD CONSTRAINT trade_proposals_cash_offered_check
  CHECK (cash_offered >= 0);

ALTER TABLE public.trade_proposals
  DROP CONSTRAINT IF EXISTS trade_proposals_cash_requested_check;
ALTER TABLE public.trade_proposals
  ADD CONSTRAINT trade_proposals_cash_requested_check
  CHECK (cash_requested >= 0);
