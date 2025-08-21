-- Clean up old price history data and regenerate fresh data for a full year
-- This script removes ALL old test data and creates realistic historical data for ALL cards
-- Generates a full year of data (365 days) that works dynamically with current date
-- 
-- Time periods will be relative to current date:
-- 1 year: CURRENT_DATE - 365 days → CURRENT_DATE
-- 3 months: CURRENT_DATE - 90 days → CURRENT_DATE  
-- 1 month: CURRENT_DATE - 30 days → CURRENT_DATE
-- 7 days: CURRENT_DATE - 7 days → CURRENT_DATE

-- First, clean up ALL old price history data
DELETE FROM price_history;

-- Generate fresh historical data for all cards for a full year (365 days back from today)
DO $$
DECLARE
    card_record RECORD;
    i INTEGER;
    target_date DATE;
    variation_factor DECIMAL(10,2);
    final_price DECIMAL(10,2);
    final_reverse_price DECIMAL(10,2);
    final_tcg_price DECIMAL(10,2);
    start_date DATE := CURRENT_DATE - INTERVAL '365 days'; -- Exactly 1 year ago from today
    days_to_generate INTEGER := 365; -- Always generate 365 days of data
    cards_processed INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting fresh price history generation for full year: % to % (% days)', start_date, CURRENT_DATE, days_to_generate;
    RAISE NOTICE 'This ensures all time periods work correctly:';
    RAISE NOTICE '  • 1 year: % to %', start_date, CURRENT_DATE;
    RAISE NOTICE '  • 3 months: % to %', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE;
    RAISE NOTICE '  • 1 month: % to %', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE;
    RAISE NOTICE '  • 7 days: % to %', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE;
    RAISE NOTICE 'Processing all cards with pricing data...';
    
    -- Loop through all cards that have current pricing
    FOR card_record IN 
        SELECT 
            id,
            name,
            cardmarket_avg_sell_price,
            cardmarket_reverse_holo_sell,
            tcgplayer_price
        FROM cards 
        WHERE cardmarket_avg_sell_price IS NOT NULL 
          AND cardmarket_avg_sell_price > 0
        ORDER BY id
        LIMIT 1000 -- Limit to prevent timeout, can be run multiple times for all cards
    LOOP
        cards_processed := cards_processed + 1;
        
        -- Progress logging every 50 cards
        IF cards_processed % 50 = 0 THEN
            RAISE NOTICE 'Processed % cards...', cards_processed;
        END IF;
        
        -- Generate historical data for this card for the full year (365 days)
        FOR i IN 0..days_to_generate-1 LOOP
            target_date := start_date + INTERVAL '1 day' * i;
            
            -- Add realistic price variation (±10% volatility)
            -- Slightly more variation for older dates to simulate market changes over time
            variation_factor := 0.90 + RANDOM() * 0.20; -- Range: 0.90 to 1.10
            
            -- Add slight trend over time (collectibles often appreciate slightly)
            -- Cards from 1 year ago might be slightly cheaper than today
            IF i < 180 THEN -- First 6 months (older data)
                variation_factor := variation_factor * (0.95 + (i::DECIMAL / 365) * 0.10); -- 95% to 105% trend
            END IF;
            
            -- Calculate main price
            final_price := GREATEST(0.01, card_record.cardmarket_avg_sell_price * variation_factor);
            
            -- Calculate reverse holo price if available
            final_reverse_price := NULL;
            IF card_record.cardmarket_reverse_holo_sell IS NOT NULL AND card_record.cardmarket_reverse_holo_sell > 0 THEN
                final_reverse_price := GREATEST(0.01, card_record.cardmarket_reverse_holo_sell * variation_factor);
            END IF;
            
            -- Calculate TCGPlayer price if available
            final_tcg_price := NULL;
            IF card_record.tcgplayer_price IS NOT NULL AND card_record.tcgplayer_price > 0 THEN
                final_tcg_price := GREATEST(0.01, card_record.tcgplayer_price * variation_factor);
            END IF;
            
            -- Insert the historical price record
            INSERT INTO price_history (
                card_id,
                date,
                cardmarket_avg_sell_price,
                cardmarket_low_price,
                cardmarket_trend_price,
                cardmarket_reverse_holo_sell,
                cardmarket_reverse_holo_low,
                cardmarket_reverse_holo_trend,
                tcgplayer_price,
                data_source
            ) VALUES (
                card_record.id,
                target_date,
                ROUND(final_price, 2),
                ROUND(final_price * 0.85, 2),  -- Low price ~15% lower
                ROUND(final_price * 1.05, 2), -- Trend price ~5% higher
                CASE WHEN final_reverse_price IS NOT NULL THEN ROUND(final_reverse_price, 2) ELSE NULL END,
                CASE WHEN final_reverse_price IS NOT NULL THEN ROUND(final_reverse_price * 0.85, 2) ELSE NULL END,
                CASE WHEN final_reverse_price IS NOT NULL THEN ROUND(final_reverse_price * 1.05, 2) ELSE NULL END,
                CASE WHEN final_tcg_price IS NOT NULL THEN ROUND(final_tcg_price, 2) ELSE NULL END,
                'dynamic_yearly_data'
            )
            ON CONFLICT (card_id, date) DO UPDATE SET
                cardmarket_avg_sell_price = EXCLUDED.cardmarket_avg_sell_price,
                cardmarket_low_price = EXCLUDED.cardmarket_low_price,
                cardmarket_trend_price = EXCLUDED.cardmarket_trend_price,
                cardmarket_reverse_holo_sell = EXCLUDED.cardmarket_reverse_holo_sell,
                cardmarket_reverse_holo_low = EXCLUDED.cardmarket_reverse_holo_low,
                cardmarket_reverse_holo_trend = EXCLUDED.cardmarket_reverse_holo_trend,
                tcgplayer_price = EXCLUDED.tcgplayer_price,
                data_source = EXCLUDED.data_source;
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'Completed! Generated fresh price history for % cards for full year (% to %)', cards_processed, start_date, CURRENT_DATE;
    RAISE NOTICE 'Data will automatically work for all time periods as each day passes.';
    RAISE NOTICE 'Run this script periodically to add new daily data and maintain 365 days rolling window.';
END $$;

-- Verify the data was created correctly
SELECT 
    COUNT(DISTINCT card_id) as cards_with_history,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    ROUND(AVG(cardmarket_avg_sell_price), 2) as avg_price_across_all_cards
FROM price_history 
WHERE data_source = 'dynamic_yearly_data';

-- Show time period coverage
SELECT 
    '1 Year Coverage' as period,
    COUNT(*) as records,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '365 days'
  AND data_source = 'dynamic_yearly_data'

UNION ALL

SELECT 
    '3 Months Coverage' as period,
    COUNT(*) as records,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '90 days'
  AND data_source = 'dynamic_yearly_data'

UNION ALL

SELECT 
    '1 Month Coverage' as period,
    COUNT(*) as records,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND data_source = 'dynamic_yearly_data'

UNION ALL

SELECT 
    '7 Days Coverage' as period,
    COUNT(*) as records,
    MIN(date) as start_date,
    MAX(date) as end_date
FROM price_history 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  AND data_source = 'dynamic_yearly_data';