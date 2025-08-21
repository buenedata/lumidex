-- Working historical data generation using confirmed card structure
-- Generate 365 days of data for cards with pricing

DO $$
DECLARE
    card_record RECORD;
    i INTEGER;
    target_date DATE;
    daily_price DECIMAL(10,2);
    cards_processed INTEGER := 0;
    total_records_inserted INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting historical data generation...';
    
    -- Get cards with CardMarket pricing (we confirmed these exist)
    FOR card_record IN 
        SELECT id, name, cardmarket_avg_sell_price
        FROM cards 
        WHERE cardmarket_avg_sell_price IS NOT NULL 
          AND cardmarket_avg_sell_price > 0
        ORDER BY cardmarket_avg_sell_price DESC
        LIMIT 100 -- Process top 100 cards by price
    LOOP
        cards_processed := cards_processed + 1;
        
        -- Progress logging every 10 cards
        IF cards_processed % 10 = 0 THEN
            RAISE NOTICE 'Processing card %: % (€%)', cards_processed, card_record.name, card_record.cardmarket_avg_sell_price;
        END IF;
        
        -- Generate 365 days of historical data going backwards from today
        FOR i IN 0..364 LOOP
            -- Calculate date going backwards
            target_date := CURRENT_DATE - i;
            
            -- Generate realistic price variation (±15% from base price)
            daily_price := card_record.cardmarket_avg_sell_price * (0.85 + RANDOM() * 0.3);
            
            -- Insert the record
            INSERT INTO price_history (
                card_id,
                date,
                cardmarket_avg_sell_price,
                data_source
            ) VALUES (
                card_record.id,
                target_date,
                ROUND(daily_price, 2),
                'confirmed_batch'
            ) ON CONFLICT (card_id, date) DO NOTHING;
            
            total_records_inserted := total_records_inserted + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Completed: % cards processed, % total records created', cards_processed, total_records_inserted;
END $$;

-- Verify the results
SELECT 
    'Summary' as info,
    COUNT(DISTINCT card_id) as cards_with_data,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM price_history 
WHERE data_source = 'confirmed_batch';

-- Check records by time period
SELECT 
    'Time period breakdown' as info,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as last_30_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as last_90_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '365 days' THEN 1 END) as last_365_days
FROM price_history 
WHERE data_source = 'confirmed_batch';

-- Show some sample data
SELECT 'Sample records' as info, card_id, date, cardmarket_avg_sell_price
FROM price_history 
WHERE data_source = 'confirmed_batch'
ORDER BY card_id, date DESC
LIMIT 20;