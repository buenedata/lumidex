-- Add TCGPlayer variant availability fields to cards table
-- These fields track which variants exist based on TCGPlayer pricing data
-- Used for determining variant boxes, not for pricing display (CardMarket is primary for pricing)

ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS tcgplayer_normal_available BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tcgplayer_holofoil_available BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tcgplayer_reverse_holo_available BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tcgplayer_1st_edition_available BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tcgplayer_last_sync TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tcgplayer_sync_status TEXT DEFAULT NULL;

-- Add comments to explain the purpose of these fields
COMMENT ON COLUMN cards.tcgplayer_normal_available IS 'Indicates if normal variant exists based on TCGPlayer pricing data';
COMMENT ON COLUMN cards.tcgplayer_holofoil_available IS 'Indicates if holofoil variant exists based on TCGPlayer pricing data';
COMMENT ON COLUMN cards.tcgplayer_reverse_holo_available IS 'Indicates if reverse holo variant exists based on TCGPlayer pricing data';
COMMENT ON COLUMN cards.tcgplayer_1st_edition_available IS 'Indicates if 1st edition/special pattern variants exist based on TCGPlayer pricing data';
COMMENT ON COLUMN cards.tcgplayer_last_sync IS 'Last time TCGPlayer variant data was synced';
COMMENT ON COLUMN cards.tcgplayer_sync_status IS 'Status of last TCGPlayer variant sync (success/failed/partial)';

-- Update comment on legacy field
COMMENT ON COLUMN cards.tcgplayer_price IS 'Legacy single price field - CardMarket pricing should be used for display';

-- Create index for faster queries on variant availability
CREATE INDEX IF NOT EXISTS idx_cards_tcgplayer_variants ON cards (
    tcgplayer_normal_available,
    tcgplayer_holofoil_available,
    tcgplayer_reverse_holo_available,
    tcgplayer_1st_edition_available
);

-- Create index for sync status queries
CREATE INDEX IF NOT EXISTS idx_cards_tcgplayer_sync ON cards (tcgplayer_last_sync, tcgplayer_sync_status);