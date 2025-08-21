-- Diagnostic script to check cards table structure and data
-- Run this first to understand why the batch scripts aren't finding cards

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'cards' 
ORDER BY ordinal_position;

-- Check total card count
SELECT COUNT(*) as total_cards FROM cards;

-- Check pricing column variations (in case the column name is different)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'cards' 
  AND column_name ILIKE '%price%';

-- Check sample of cards with any pricing data
SELECT id, name, 
       cardmarket_avg_sell_price,
       tcgplayer_avg_sell_price,
       ebay_avg_sell_price
FROM cards 
WHERE cardmarket_avg_sell_price IS NOT NULL 
   OR tcgplayer_avg_sell_price IS NOT NULL 
   OR ebay_avg_sell_price IS NOT NULL
LIMIT 10;

-- Check cards with cardmarket pricing specifically
SELECT COUNT(*) as cards_with_cardmarket_pricing
FROM cards 
WHERE cardmarket_avg_sell_price IS NOT NULL 
  AND cardmarket_avg_sell_price > 0;

-- Show a few example cards with cardmarket pricing
SELECT id, name, cardmarket_avg_sell_price, set_id
FROM cards 
WHERE cardmarket_avg_sell_price IS NOT NULL 
  AND cardmarket_avg_sell_price > 0
ORDER BY cardmarket_avg_sell_price DESC
LIMIT 5;