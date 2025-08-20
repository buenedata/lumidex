-- Add missing columns to trades table for full functionality
-- This includes money offers, shipping preferences, and parent trade tracking

-- Add parent_trade_id column for counter offer tracking
ALTER TABLE trades ADD COLUMN IF NOT EXISTS parent_trade_id UUID REFERENCES trades(id);

-- Add money offer columns
ALTER TABLE trades ADD COLUMN IF NOT EXISTS initiator_money_offer DECIMAL(10,2) DEFAULT 0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS recipient_money_offer DECIMAL(10,2) DEFAULT 0;

-- Add shipping preference columns
ALTER TABLE trades ADD COLUMN IF NOT EXISTS initiator_shipping_included BOOLEAN DEFAULT true;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS recipient_shipping_included BOOLEAN DEFAULT true;

-- Add trade method column
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_method VARCHAR(50) DEFAULT 'simultaneous';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_parent_trade_id ON trades(parent_trade_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_initiator_id ON trades(initiator_id);
CREATE INDEX IF NOT EXISTS idx_trades_recipient_id ON trades(recipient_id);

-- Update any existing trades to have default values
UPDATE trades 
SET 
  initiator_money_offer = 0,
  recipient_money_offer = 0,
  initiator_shipping_included = true,
  recipient_shipping_included = true,
  trade_method = 'simultaneous'
WHERE 
  initiator_money_offer IS NULL 
  OR recipient_money_offer IS NULL 
  OR initiator_shipping_included IS NULL 
  OR recipient_shipping_included IS NULL 
  OR trade_method IS NULL;