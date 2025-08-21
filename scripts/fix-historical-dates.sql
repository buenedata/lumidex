-- Fix the historical data generation - create proper date ranges
-- This script will generate historical data going back in time properly

DO $$
DECLARE
    card_record RECORD;
    i INTEGER;
    target_date DATE;
    daily_price DECIMAL(10,2);
    daily_tcg_price DECIMAL(10,2);
    daily_reverse_price DECIMAL(10,2);
    cards_processed INTEGER := 0;
    base_date DATE := CURRENT_DATE;
BEGIN
    RAISE NOTICE 'Creating proper historical pricing data going back 365 days...';
    
    -- First, clear existing data from the previous script
    DELETE FROM price_history WHERE data_source = 'all_sources_batch';
    
    -- Process cards with ANY pricing data (CardMarket OR TCGPlayer)
    FOR card_record IN 
        SELECT id, name,
               cardmarket_avg_sell_price,
               cardmarket_reverse_holo_sell,
               tcgplayer_price
        FROM cards 
        WHERE (cardmarket_avg_sell_price IS NOT NULL AND cardmarket_avg_sell_price > 0)
           OR (tcgplayer_price IS NOT NULL AND tcgplayer_price > 0)
        ORDER BY id
        LIMIT 50 -- Smaller batch to ensure it works
    LOOP
        cards_processed := cards_processed + 1;
        
        -- Progress logging every 10 cards
        IF cards_processed % 10 = 0 THEN
            RAISE NOTICE 'Processed % cards...', cards_processed;
        END IF;
        
        -- Add 365 days of historical data for this card
        FOR i IN 0..364 LOOP
            -- Calculate target date properly
            target_date := base_date - i;
            
            -- Calculate CardMarket price variation
            IF card_record.cardmarket_avg_sell_price IS NOT NULL AND card_record.cardmarket_avg_sell_price > 0 THEN
                daily_price := card_record.cardmarket_avg_sell_price * (0.8 + RANDOM() * 0.4); -- ±20% variation
            ELSE
                daily_price := NULL;
            END IF;
            
            -- Calculate TCGPlayer price variation
            IF card_record.tcgplayer_price IS NOT NULL AND card_record.tcgplayer_price > 0 THEN
                daily_tcg_price := card_record.tcgplayer_price * (0.8 + RANDOM() * 0.4); -- ±20% variation
            ELSE
                daily_tcg_price := NULL;
            END IF;
            
            -- Calculate reverse holo price variation
            IF card_record.cardmarket_reverse_holo_sell IS NOT NULL AND card_record.cardmarket_reverse_holo_sell > 0 THEN
                daily_reverse_price := card_record.cardmarket_reverse_holo_sell * (0.8 + RANDOM() * 0.4); -- ±20% variation
            ELSE
                daily_reverse_price := NULL;
            END IF;
            
            INSERT INTO price_history (
                card_id,
                date,
                cardmarket_avg_sell_price,
                cardmarket_reverse_holo_sell,
                tcgplayer_price,
                data_source
            ) VALUES (
                card_record.id,
                target_date,
                CASE WHEN daily_price IS NOT NULL THEN ROUND(daily_price, 2) ELSE NULL END,
                CASE WHEN daily_reverse_price IS NOT NULL THEN ROUND(daily_reverse_price, 2) ELSE NULL END,
                CASE WHEN daily_tcg_price IS NOT NULL THEN ROUND(daily_tcg_price, 2) ELSE NULL END,
                'fixed_historical_batch'
            ) ON CONFLICT (card_id, date) DO NOTHING;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Added proper historical data for % cards (365 days each)', cards_processed;
END $$;

-- Verify the data with proper date ranges
SELECT 
    COUNT(DISTINCT card_id) as cards_with_data,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    COUNT(CASE WHEN cardmarket_avg_sell_price IS NOT NULL THEN 1 END) as cardmarket_records,
    COUNT(CASE WHEN tcgplayer_price IS NOT NULL THEN 1 END) as tcgplayer_records,
    COUNT(CASE WHEN cardmarket_reverse_holo_sell IS NOT NULL THEN 1 END) as reverse_holo_records,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as last_30_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as last_90_days
FROM price_history 
WHERE data_source = 'fixed_historical_batch';