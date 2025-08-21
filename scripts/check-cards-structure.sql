-- Simple diagnostic to check cards table structure
-- Find out what pricing columns actually exist

-- Check all columns in the cards table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'cards' 
ORDER BY ordinal_position;

-- Check specifically for pricing-related columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cards' 
  AND column_name ILIKE '%price%';

-- Count total cards
SELECT COUNT(*) as total_cards FROM cards;

-- Check what pricing data exists (using only cardmarket column)
SELECT COUNT(*) as cards_with_cardmarket_pricing
FROM cards 
WHERE cardmarket_avg_sell_price IS NOT NULL 
  AND cardmarket_avg_sell_price > 0;

-- Show sample cards with pricing
SELECT id, name, cardmarket_avg_sell_price
FROM cards 
WHERE cardmarket_avg_sell_price IS NOT NULL 
  AND cardmarket_avg_sell_price > 0
LIMIT 5;