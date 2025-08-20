-- Historical Pricing Data Table
-- This table will store daily price snapshots for each card to enable historical price graphs

CREATE TABLE IF NOT EXISTS price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  date date NOT NULL,
  
  -- CardMarket pricing data
  cardmarket_avg_sell_price decimal(10,2),
  cardmarket_low_price decimal(10,2),
  cardmarket_trend_price decimal(10,2),
  cardmarket_suggested_price decimal(10,2),
  cardmarket_reverse_holo_sell decimal(10,2),
  cardmarket_reverse_holo_low decimal(10,2),
  cardmarket_reverse_holo_trend decimal(10,2),
  
  -- TCGPlayer pricing data  
  tcgplayer_price decimal(10,2),
  tcgplayer_normal_market decimal(10,2),
  tcgplayer_normal_low decimal(10,2),
  tcgplayer_normal_mid decimal(10,2),
  tcgplayer_normal_high decimal(10,2),
  tcgplayer_holofoil_market decimal(10,2),
  tcgplayer_holofoil_low decimal(10,2),
  tcgplayer_holofoil_mid decimal(10,2),
  tcgplayer_holofoil_high decimal(10,2),
  tcgplayer_reverse_holo_market decimal(10,2),
  tcgplayer_reverse_holo_low decimal(10,2),
  tcgplayer_reverse_holo_mid decimal(10,2),
  tcgplayer_reverse_holo_high decimal(10,2),
  
  -- 1st Edition pricing (if available)
  tcgplayer_1st_edition_normal_market decimal(10,2),
  tcgplayer_1st_edition_normal_low decimal(10,2),
  tcgplayer_1st_edition_normal_mid decimal(10,2),
  tcgplayer_1st_edition_normal_high decimal(10,2),
  tcgplayer_1st_edition_holofoil_market decimal(10,2),
  tcgplayer_1st_edition_holofoil_low decimal(10,2),
  tcgplayer_1st_edition_holofoil_mid decimal(10,2),
  tcgplayer_1st_edition_holofoil_high decimal(10,2),
  
  -- Metadata
  data_source text NOT NULL DEFAULT 'daily_sync', -- 'daily_sync', 'backfill', 'manual'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure one record per card per day
  UNIQUE(card_id, date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_price_history_card_id ON price_history(card_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date);
CREATE INDEX IF NOT EXISTS idx_price_history_card_date ON price_history(card_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON price_history(created_at);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_price_history_updated_at 
  BEFORE UPDATE ON price_history 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Allow read access for authenticated users
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users" ON price_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert/update for service role (for background jobs)
CREATE POLICY "Allow full access for service role" ON price_history
  FOR ALL USING (auth.role() = 'service_role');

-- Add helpful comments
COMMENT ON TABLE price_history IS 'Historical pricing data for Pokemon cards, captured daily';
COMMENT ON COLUMN price_history.date IS 'Date of the price snapshot (UTC date)';
COMMENT ON COLUMN price_history.data_source IS 'Source of the data: daily_sync, backfill, or manual';
COMMENT ON INDEX idx_price_history_card_date IS 'Optimized for fetching recent price history for a specific card';