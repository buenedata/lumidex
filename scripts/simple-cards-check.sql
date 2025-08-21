-- Simple diagnostic to understand the cards table structure and data

-- Check total number of cards
SELECT 'Total cards:' as info, COUNT(*) as count FROM cards;

-- Check what columns exist in cards table
SELECT 'Cards table columns:' as info, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cards' 
ORDER BY ordinal_position;

-- Check for any pricing columns (case insensitive)
SELECT 'Pricing columns:' as info, column_name 
FROM information_schema.columns 
WHERE table_name = 'cards' 
  AND column_name ILIKE '%price%';

-- Show first 5 cards with all their data to see structure
SELECT 'Sample cards:' as info, * FROM cards LIMIT 5;

-- Check specifically for CardMarket pricing
SELECT 'Cards with CardMarket pricing:' as info, COUNT(*) as count
FROM cards 
WHERE cardmarket_avg_sell_price IS NOT NULL 
  AND cardmarket_avg_sell_price > 0;

-- Check specifically for TCGPlayer pricing (if column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'tcgplayer_price') THEN
        EXECUTE 'SELECT ''Cards with TCGPlayer pricing:'' as info, COUNT(*) as count FROM cards WHERE tcgplayer_price IS NOT NULL AND tcgplayer_price > 0';
    ELSE
        SELECT 'TCGPlayer column does not exist' as info, 0 as count;
    END IF;
END $$;

-- Show any cards that have ANY non-null pricing data
SELECT 'Cards with any pricing:' as info, id, name,
       cardmarket_avg_sell_price
FROM cards 
WHERE cardmarket_avg_sell_price IS NOT NULL
LIMIT 10;