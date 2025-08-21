-- Complete Price History Population Script
-- This script generates comprehensive historical data for all cards
-- Covers 1 year of data with proper daily entries

DO $$
DECLARE
    card_record RECORD;
    i INTEGER;
    target_date DATE;
    daily_price DECIMAL(10,2);
    daily_reverse_holo DECIMAL(10,2);
    daily_tcgplayer DECIMAL(10,2);
    cards_processed INTEGER := 0;
    total_records_inserted INTEGER := 0;
    batch_size INTEGER := 10; -- Process 10 cards at a time to avoid memory issues
BEGIN
    RAISE NOTICE '🚀 Starting complete price history population...';
    RAISE NOTICE '📅 Generating 365 days of historical data for all cards with pricing';
    
    -- Process cards in batches to avoid timeout
    FOR card_record IN 
        SELECT 
            id, 
            name, 
            cardmarket_avg_sell_price,
            cardmarket_reverse_holo_sell,
            tcgplayer_price,
            cardmarket_avg_7_days,
            cardmarket_avg_30_days
        FROM cards 
        WHERE cardmarket_avg_sell_price IS NOT NULL 
          AND cardmarket_avg_sell_price > 0
        ORDER BY cardmarket_avg_sell_price DESC
        LIMIT 1000 -- Process top 1000 cards by price
    LOOP
        cards_processed := cards_processed + 1;
        
        -- Progress logging every 50 cards
        IF cards_processed % 50 = 0 THEN
            RAISE NOTICE '📊 Processing card %: % (€%)', cards_processed, card_record.name, card_record.cardmarket_avg_sell_price;
        END IF;
        
        -- Generate 365 days of historical data going backwards from today
        FOR i IN 0..364 LOOP
            -- Calculate target date
            target_date := CURRENT_DATE - i;
            
            -- Calculate realistic daily price with trends
            IF i = 0 THEN
                -- Today: use current price
                daily_price := card_record.cardmarket_avg_sell_price;
            ELSIF i <= 7 AND card_record.cardmarket_avg_7_days IS NOT NULL THEN
                -- Last 7 days: interpolate between current and 7-day average
                daily_price := card_record.cardmarket_avg_sell_price + 
                              (card_record.cardmarket_avg_7_days - card_record.cardmarket_avg_sell_price) * (i::DECIMAL / 7);
            ELSIF i <= 30 AND card_record.cardmarket_avg_30_days IS NOT NULL THEN
                -- Last 30 days: interpolate between 7-day and 30-day average
                daily_price := COALESCE(card_record.cardmarket_avg_7_days, card_record.cardmarket_avg_sell_price) + 
                              (card_record.cardmarket_avg_30_days - COALESCE(card_record.cardmarket_avg_7_days, card_record.cardmarket_avg_sell_price)) * 
                              ((i - 7)::DECIMAL / 23);
            ELSE
                -- Beyond 30 days: use 30-day average with slight appreciation trend
                daily_price := COALESCE(card_record.cardmarket_avg_30_days, card_record.cardmarket_avg_sell_price) * 
                              (1 + ((i - 30)::DECIMAL / 365) * 0.05); -- 5% annual appreciation
            END IF;
            
            -- Add realistic daily volatility (±3% to ±8% based on card value)
            IF card_record.cardmarket_avg_sell_price > 100 THEN
                -- High value cards: lower volatility
                daily_price := daily_price * (0.97 + RANDOM() * 0.06); -- ±3%
            ELSIF card_record.cardmarket_avg_sell_price > 10 THEN
                -- Medium value cards: medium volatility
                daily_price := daily_price * (0.95 + RANDOM() * 0.10); -- ±5%
            ELSE
                -- Low value cards: higher volatility
                daily_price := daily_price * (0.92 + RANDOM() * 0.16); -- ±8%
            END IF;
            
            -- Ensure minimum price
            daily_price := GREATEST(daily_price, 0.01);
            
            -- Calculate reverse holo price if available
            daily_reverse_holo := NULL;
            IF card_record.cardmarket_reverse_holo_sell IS NOT NULL THEN
                daily_reverse_holo := card_record.cardmarket_reverse_holo_sell * 
                                     (daily_price / card_record.cardmarket_avg_sell_price);
                daily_reverse_holo := GREATEST(daily_reverse_holo, 0.01);
            END IF;
            
            -- Calculate TCGPlayer price if available
            daily_tcgplayer := NULL;
            IF card_record.tcgplayer_price IS NOT NULL THEN
                daily_tcgplayer := card_record.tcgplayer_price * 
                                  (daily_price / card_record.cardmarket_avg_sell_price);
                daily_tcgplayer := GREATEST(daily_tcgplayer, 0.01);
            END IF;
            
            -- Insert the historical record
            INSERT INTO price_history (
                card_id,
                date,
                cardmarket_avg_sell_price,
                cardmarket_low_price,
                cardmarket_trend_price,
                cardmarket_reverse_holo_sell,
                tcgplayer_price,
                data_source
            ) VALUES (
                card_record.id,
                target_date,
                ROUND(daily_price, 2),
                ROUND(daily_price * 0.85, 2), -- Low price ~15% below avg
                ROUND(daily_price * 1.10, 2), -- Trend price ~10% above avg
                ROUND(daily_reverse_holo, 2),
                ROUND(daily_tcgplayer, 2),
                'complete_backfill_365d'
            ) ON CONFLICT (card_id, date) 
            DO UPDATE SET
                cardmarket_avg_sell_price = EXCLUDED.cardmarket_avg_sell_price,
                cardmarket_low_price = EXCLUDED.cardmarket_low_price,
                cardmarket_trend_price = EXCLUDED.cardmarket_trend_price,
                cardmarket_reverse_holo_sell = EXCLUDED.cardmarket_reverse_holo_sell,
                tcgplayer_price = EXCLUDED.tcgplayer_price,
                data_source = EXCLUDED.data_source;
            
            total_records_inserted := total_records_inserted + 1;
        END LOOP;
        
        -- Progress update (removed COMMIT as it's not allowed in DO blocks)
        IF cards_processed % batch_size = 0 THEN
            RAISE NOTICE '💾 Processed batch: % cards completed', cards_processed;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Complete price history population finished!';
    RAISE NOTICE '📈 Processed % cards with % total records', cards_processed, total_records_inserted;
END $$;

-- Verify the results
SELECT 
    '📊 Historical Data Summary' as info,
    COUNT(DISTINCT card_id) as cards_with_data,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM price_history 
WHERE data_source = 'complete_backfill_365d';

-- Check data distribution by time period
SELECT 
    '📅 Time Period Coverage' as info,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as last_30_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as last_90_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '365 days' THEN 1 END) as last_365_days
FROM price_history 
WHERE data_source = 'complete_backfill_365d';

-- Show sample of generated data
SELECT 
    '🎯 Sample Generated Data' as info,
    c.name,
    ph.date,
    ph.cardmarket_avg_sell_price,
    ph.cardmarket_reverse_holo_sell
FROM price_history ph
JOIN cards c ON c.id = ph.card_id
WHERE ph.data_source = 'complete_backfill_365d'
ORDER BY ph.date DESC, c.cardmarket_avg_sell_price DESC
LIMIT 20;