-- Add preferred_price_source column to profiles table
-- This allows users to choose between CardMarket (EUR) and TCGPlayer (USD) pricing

-- Add the column with a default value
ALTER TABLE profiles 
ADD COLUMN preferred_price_source TEXT DEFAULT 'cardmarket' 
CHECK (preferred_price_source IN ('cardmarket', 'tcgplayer'));

-- Add a comment to document the column
COMMENT ON COLUMN profiles.preferred_price_source IS 'User preference for price data source: cardmarket (EUR) or tcgplayer (USD)';

-- Update existing users to have the default value
UPDATE profiles 
SET preferred_price_source = 'cardmarket' 
WHERE preferred_price_source IS NULL;