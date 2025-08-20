-- Add missing fields to trades table for money offers and trade methods
ALTER TABLE trades ADD COLUMN IF NOT EXISTS initiator_money_offer DECIMAL(10,2) DEFAULT 0 CHECK (initiator_money_offer >= 0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS recipient_money_offer DECIMAL(10,2) DEFAULT 0 CHECK (recipient_money_offer >= 0);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_method TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS initiator_shipping_included BOOLEAN DEFAULT true;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS recipient_shipping_included BOOLEAN DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN trades.initiator_money_offer IS 'Money amount offered by the trade initiator (in NOK)';
COMMENT ON COLUMN trades.recipient_money_offer IS 'Money amount offered by the trade recipient (in NOK)';
COMMENT ON COLUMN trades.trade_method IS 'Selected trade method (digital_first, simultaneous, meetup, escrow)';
COMMENT ON COLUMN trades.initiator_shipping_included IS 'Whether shipping costs are included in initiator offer';
COMMENT ON COLUMN trades.recipient_shipping_included IS 'Whether shipping costs are included in recipient offer';