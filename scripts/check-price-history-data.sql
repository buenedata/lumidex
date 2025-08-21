-- Diagnostic script to check if price history data exists
-- Run this in Supabase SQL Editor to verify data was created

-- Check if price_history table exists and has data
SELECT 
    'Price History Table Status' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT card_id) as unique_cards,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM price_history;

-- Check specifically for Blastoise ex data
SELECT 
    'Blastoise ex Data' as check_type,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    MIN(cardmarket_avg_sell_price) as min_price,
    MAX(cardmarket_avg_sell_price) as max_price,
    AVG(cardmarket_avg_sell_price) as avg_price
FROM price_history 
WHERE card_id = 'sv3pt5-9';

-- Check data coverage for different time periods (relative to current date)
SELECT 
    '7 Days Coverage' as period,
    COUNT(*) as records_count,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND card_id = 'sv3pt5-9'

UNION ALL

SELECT 
    '1 Month Coverage' as period,
    COUNT(*) as records_count,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND card_id = 'sv3pt5-9'

UNION ALL

SELECT 
    '3 Months Coverage' as period,
    COUNT(*) as records_count,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '90 days'
  AND card_id = 'sv3pt5-9'

UNION ALL

SELECT 
    '1 Year Coverage' as period,
    COUNT(*) as records_count,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '365 days'
  AND card_id = 'sv3pt5-9';

-- Check what data sources exist
SELECT 
    data_source,
    COUNT(*) as record_count,
    COUNT(DISTINCT card_id) as unique_cards
FROM price_history 
GROUP BY data_source;

-- Show sample of recent data for Blastoise ex
SELECT 
    date,
    cardmarket_avg_sell_price,
    data_source
FROM price_history 
WHERE card_id = 'sv3pt5-9'
ORDER BY date DESC 
LIMIT 10;

-- Check if the card exists in the cards table
SELECT 
    'Card Exists Check' as check_type,
    id,
    name,
    cardmarket_avg_sell_price
FROM cards 
WHERE id = 'sv3pt5-9';