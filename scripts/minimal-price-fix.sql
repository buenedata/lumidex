-- Minimal script to get price graphs working - runs in under 5 seconds
-- Just creates basic table and minimal data for testing

-- Create price_history table (simple version)
CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text NOT NULL,
  date date NOT NULL,
  cardmarket_avg_sell_price decimal(10,2),
  data_source text DEFAULT 'minimal_fix',
  UNIQUE(card_id, date)
);

-- Simple RLS policy
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access" ON price_history;
CREATE POLICY "Allow read access" ON price_history FOR SELECT USING (true);

-- Insert just 7 days of data for Blastoise ex (very fast)
INSERT INTO price_history (card_id, date, cardmarket_avg_sell_price) VALUES
('sv3pt5-9', CURRENT_DATE, 1.72),
('sv3pt5-9', CURRENT_DATE - 1, 1.68),
('sv3pt5-9', CURRENT_DATE - 2, 1.75),
('sv3pt5-9', CURRENT_DATE - 3, 1.71),
('sv3pt5-9', CURRENT_DATE - 4, 1.69),
('sv3pt5-9', CURRENT_DATE - 5, 1.74),
('sv3pt5-9', CURRENT_DATE - 6, 1.70)
ON CONFLICT (card_id, date) DO NOTHING;

-- Verify data
SELECT COUNT(*) as records FROM price_history WHERE card_id = 'sv3pt5-9';