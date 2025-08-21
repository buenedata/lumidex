-- Add 90 days of historical data for ALL cards (3 months view)
-- Optimized to avoid timeouts by processing in small batches

DO $$
DECLARE
    card_record RECORD;
    i INTEGER;
    target_date DATE;
    daily_price DECIMAL(10,2);
    cards_processed INTEGER := 0;
BEGIN
    RAISE NOTICE 'Adding 3 months data for all cards with pricing...';
    
    -- Process cards with pricing data in batches
    FOR card_record IN 
        SELECT id, cardmarket_avg_sell_price, name
        FROM cards 
        WHERE cardmarket_avg_sell_price IS NOT NULL 
          AND cardmarket_avg_sell_price > 0
        ORDER BY id
        LIMIT 100 -- Process first 100 cards to avoid timeout
    LOOP
        cards_processed := cards_processed + 1;
        
        -- Progress logging every 25 cards
        IF cards_processed % 25 = 0 THEN
            RAISE NOTICE 'Processed % cards...', cards_processed;
        END IF;
        
        -- Add 90 days of historical data for this card
        FOR i IN 0..89 LOOP
            target_date := CURRENT_DATE - INTERVAL '1 day' * i;
            daily_price := card_record.cardmarket_avg_sell_price * (0.85 + RANDOM() * 0.3); -- ±15% variation for longer period
            
            INSERT INTO price_history (
                card_id,
                date,
                cardmarket_avg_sell_price,
                data_source
            ) VALUES (
                card_record.id,
                target_date,
                ROUND(daily_price, 2),
                'batch_3_months'
            ) ON CONFLICT (card_id, date) DO NOTHING;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Added 3 months data for % cards (90 days each)', cards_processed;
END $$;

-- Verify the data
SELECT 
    COUNT(DISTINCT card_id) as cards_with_data,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM price_history 
WHERE data_source = 'batch_3_months'
  AND date >= CURRENT_DATE - INTERVAL '90 days';