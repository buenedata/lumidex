-- Add 30 days of historical data for 1 month view
-- Run this after minimal-price-fix.sql

DO $$
DECLARE
    i INTEGER;
    target_date DATE;
    base_price DECIMAL(10,2) := 1.72;
    daily_price DECIMAL(10,2);
BEGIN
    -- Add days 8-30 (we already have days 0-6 from minimal script)
    FOR i IN 8..30 LOOP
        target_date := CURRENT_DATE - INTERVAL '1 day' * i;
        daily_price := base_price * (0.9 + RANDOM() * 0.2); -- ±10% variation
        
        INSERT INTO price_history (
            card_id,
            date,
            cardmarket_avg_sell_price,
            data_source
        ) VALUES (
            'sv3pt5-9',
            target_date,
            ROUND(daily_price, 2),
            '1_month_data'
        ) ON CONFLICT (card_id, date) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Added 1 month historical data (30 days total)';
END $$;

-- Verify 1 month data
SELECT 
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM price_history 
WHERE card_id = 'sv3pt5-9' 
  AND date >= CURRENT_DATE - INTERVAL '30 days';