-- =====================================================
-- POKEMON TCG COLLECTION - DATABASE SCHEMA
-- =====================================================
-- This script will completely reset the database and create fresh tables
-- WARNING: This will delete ALL existing data in these tables!

-- Drop all existing tables (in reverse dependency order)
DROP TABLE IF EXISTS collection_stats CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS trade_items CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS user_collections CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS sets CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS privacy_level CASCADE;
DROP TYPE IF EXISTS card_condition CASCADE;
DROP TYPE IF EXISTS friendship_status CASCADE;
DROP TYPE IF EXISTS trade_status CASCADE;
DROP TYPE IF EXISTS sync_status CASCADE;
DROP TYPE IF EXISTS condition_preference CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS calculate_collection_stats(UUID) CASCADE;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_sets_updated_at ON sets;
DROP TRIGGER IF EXISTS update_cards_updated_at ON cards;
DROP TRIGGER IF EXISTS update_user_collections_updated_at ON user_collections;
DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
DROP TRIGGER IF EXISTS update_wishlists_updated_at ON wishlists;
DROP TRIGGER IF EXISTS update_collection_stats_updated_at ON collection_stats;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE privacy_level AS ENUM ('public', 'friends', 'private');
CREATE TYPE card_condition AS ENUM ('mint', 'near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE trade_status AS ENUM ('pending', 'accepted', 'declined', 'completed', 'cancelled');
CREATE TYPE sync_status AS ENUM ('success', 'failed', 'partial');
CREATE TYPE condition_preference AS ENUM ('any', 'mint', 'near_mint', 'lightly_played', 'moderately_played');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL CHECK (length(username) >= 3 AND length(username) <= 20),
  display_name TEXT CHECK (length(display_name) <= 50),
  avatar_url TEXT,
  bio TEXT CHECK (length(bio) <= 500),
  location TEXT CHECK (length(location) <= 100),
  privacy_level privacy_level DEFAULT 'public',
  show_collection_value BOOLEAN DEFAULT true,
  preferred_currency TEXT DEFAULT 'EUR',
  preferred_language TEXT DEFAULT 'en',
  preferred_price_source TEXT DEFAULT 'cardmarket' CHECK (preferred_price_source IN ('cardmarket', 'tcgplayer')),
  setup_completed BOOLEAN DEFAULT false,
  setup_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ
);

-- Sets table
CREATE TABLE sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  series TEXT NOT NULL,
  total_cards INTEGER NOT NULL CHECK (total_cards > 0),
  release_date DATE NOT NULL,
  symbol_url TEXT,
  logo_url TEXT,
  background_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards table
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  rarity TEXT NOT NULL,
  types TEXT[] NOT NULL DEFAULT '{}',
  hp INTEGER CHECK (hp > 0),
  image_small TEXT NOT NULL,
  image_large TEXT NOT NULL,
  
  -- CardMarket pricing (EUR)
  cardmarket_url TEXT,
  cardmarket_updated_at TIMESTAMPTZ,
  cardmarket_avg_sell_price DECIMAL(10,2) CHECK (cardmarket_avg_sell_price >= 0),
  cardmarket_low_price DECIMAL(10,2) CHECK (cardmarket_low_price >= 0),
  cardmarket_trend_price DECIMAL(10,2) CHECK (cardmarket_trend_price >= 0),
  cardmarket_suggested_price DECIMAL(10,2) CHECK (cardmarket_suggested_price >= 0),
  cardmarket_german_pro_low DECIMAL(10,2) CHECK (cardmarket_german_pro_low >= 0),
  cardmarket_low_price_ex_plus DECIMAL(10,2) CHECK (cardmarket_low_price_ex_plus >= 0),
  cardmarket_reverse_holo_sell DECIMAL(10,2) CHECK (cardmarket_reverse_holo_sell >= 0),
  cardmarket_reverse_holo_low DECIMAL(10,2) CHECK (cardmarket_reverse_holo_low >= 0),
  cardmarket_reverse_holo_trend DECIMAL(10,2) CHECK (cardmarket_reverse_holo_trend >= 0),
  cardmarket_avg_1_day DECIMAL(10,2) CHECK (cardmarket_avg_1_day >= 0),
  cardmarket_avg_7_days DECIMAL(10,2) CHECK (cardmarket_avg_7_days >= 0),
  cardmarket_avg_30_days DECIMAL(10,2) CHECK (cardmarket_avg_30_days >= 0),
  cardmarket_last_sync TIMESTAMPTZ,
  cardmarket_sync_status sync_status,
  
  -- Legacy TCGPlayer data (optional, USD)
  tcgplayer_price DECIMAL(10,2) CHECK (tcgplayer_price >= 0),
  tcgplayer_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(set_id, number)
);

-- User collections table
CREATE TABLE user_collections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition card_condition DEFAULT 'near_mint',
  is_foil BOOLEAN DEFAULT false,
  acquired_date DATE,
  notes TEXT CHECK (length(notes) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, card_id, condition, is_foil)
);

-- Friendships table
CREATE TABLE friendships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Trades table
CREATE TABLE trades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  initiator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status trade_status DEFAULT 'pending',
  initiator_message TEXT CHECK (length(initiator_message) <= 1000),
  recipient_message TEXT CHECK (length(recipient_message) <= 1000),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  
  CHECK (initiator_id != recipient_id)
);

-- Trade items table
CREATE TABLE trade_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition TEXT NOT NULL,
  is_foil BOOLEAN DEFAULT false,
  notes TEXT CHECK (length(notes) <= 200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wishlists table
CREATE TABLE wishlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  max_price_eur DECIMAL(10,2) CHECK (max_price_eur >= 0),
  condition_preference condition_preference DEFAULT 'any',
  notes TEXT CHECK (length(notes) <= 300),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, card_id)
);

-- User achievements table
CREATE TABLE user_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_data JSONB DEFAULT '{}',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, achievement_type)
);

-- Collection stats table (computed/cached)
CREATE TABLE collection_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  set_id TEXT REFERENCES sets(id) ON DELETE CASCADE,
  total_cards_in_set INTEGER CHECK (total_cards_in_set > 0),
  owned_cards INTEGER NOT NULL DEFAULT 0 CHECK (owned_cards >= 0),
  completion_percentage DECIMAL(5,2) CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  total_value_eur DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_value_eur >= 0),
  total_value_usd DECIMAL(12,2) CHECK (total_value_usd >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, set_id)
);

-- Add favorite_set_id column and foreign key constraint after sets table is created
-- (This is done after table creation to avoid circular dependency issues)
ALTER TABLE profiles ADD COLUMN favorite_set_id TEXT;
ALTER TABLE profiles ADD CONSTRAINT profiles_favorite_set_id_fkey
  FOREIGN KEY (favorite_set_id) REFERENCES sets(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_last_active ON profiles(last_active);
CREATE INDEX idx_cards_set_id ON cards(set_id);
CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_types ON cards USING GIN(types);
CREATE INDEX idx_cards_cardmarket_price ON cards(cardmarket_avg_sell_price);
CREATE INDEX idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX idx_user_collections_card_id ON user_collections(card_id);
CREATE INDEX idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee_id ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_trades_initiator_id ON trades(initiator_id);
CREATE INDEX idx_trades_recipient_id ON trades(recipient_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trade_items_trade_id ON trade_items(trade_id);
CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX idx_wishlists_card_id ON wishlists(card_id);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_collection_stats_user_id ON collection_stats(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sets_updated_at BEFORE UPDATE ON sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_collections_updated_at BEFORE UPDATE ON user_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wishlists_updated_at BEFORE UPDATE ON wishlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collection_stats_updated_at BEFORE UPDATE ON collection_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_stats ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (privacy_level = 'public');

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Sets and cards are public (read-only for users)
CREATE POLICY "Sets are viewable by everyone" ON sets
  FOR SELECT USING (true);

CREATE POLICY "Cards are viewable by everyone" ON cards
  FOR SELECT USING (true);

-- User collections policies
CREATE POLICY "Users can view their own collections" ON user_collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own collections" ON user_collections
  FOR ALL USING (auth.uid() = user_id);

-- Friendships policies
CREATE POLICY "Users can view their own friendships" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can manage their own friendships" ON friendships
  FOR ALL USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Trades policies
CREATE POLICY "Users can view their own trades" ON trades
  FOR SELECT USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can manage their own trades" ON trades
  FOR ALL USING (auth.uid() = initiator_id OR auth.uid() = recipient_id);

-- Trade items policies
CREATE POLICY "Users can view trade items for their trades" ON trade_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trades 
      WHERE trades.id = trade_items.trade_id 
      AND (trades.initiator_id = auth.uid() OR trades.recipient_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage trade items for their trades" ON trade_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trades 
      WHERE trades.id = trade_items.trade_id 
      AND (trades.initiator_id = auth.uid() OR trades.recipient_id = auth.uid())
    )
  );

-- Wishlists policies
CREATE POLICY "Users can view their own wishlists" ON wishlists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own wishlists" ON wishlists
  FOR ALL USING (auth.uid() = user_id);

-- User achievements policies
CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Collection stats policies
CREATE POLICY "Users can view their own collection stats" ON collection_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own collection stats" ON collection_stats
  FOR ALL USING (auth.uid() = user_id);

-- Create a function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to calculate collection stats
CREATE OR REPLACE FUNCTION calculate_collection_stats(user_uuid UUID)
RETURNS TABLE (
  total_cards BIGINT,
  unique_cards BIGINT,
  total_value_eur NUMERIC,
  sets_with_cards BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(uc.quantity), 0) as total_cards,
    COUNT(DISTINCT uc.card_id) as unique_cards,
    COALESCE(SUM(uc.quantity * COALESCE(c.cardmarket_avg_sell_price, 0)), 0) as total_value_eur,
    COUNT(DISTINCT c.set_id) as sets_with_cards
  FROM user_collections uc
  LEFT JOIN cards c ON uc.card_id = c.id
  WHERE uc.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

/*
INSTRUCTIONS FOR RUNNING THIS SCHEMA:

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste this entire schema.sql file
4. Click "Run" to execute

WARNING: This will delete ALL existing data in the following tables:
- profiles
- sets  
- cards
- user_collections
- friendships
- trades
- trade_items
- wishlists
- user_achievements
- collection_stats

The schema includes:
✅ Complete table structure for Pokemon TCG collection
✅ CardMarket pricing integration fields
✅ Social features (friends, trades, wishlists)
✅ Achievement system
✅ Row Level Security (RLS) policies
✅ Optimized indexes for performance
✅ Automatic triggers for updated_at fields
✅ User registration handling

After running this schema:
1. Your database will be ready for the Pokemon TCG Collection app
2. Users can register and their profiles will be automatically created
3. All security policies are in place
4. The app can start importing Pokemon card data

Next steps:
1. Configure your .env.local file with Supabase credentials
2. Start the Next.js development server
3. Begin importing Pokemon card data via the Pokemon TCG API
*/