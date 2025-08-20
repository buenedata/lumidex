-- Performance optimization indexes for Pokemon TCG Collection app
-- This migration adds critical indexes to improve query performance

-- Add indexes for user_collections table (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_card_id ON user_collections(card_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_user_card ON user_collections(user_id, card_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_created_at ON user_collections(created_at);
CREATE INDEX IF NOT EXISTS idx_user_collections_user_created ON user_collections(user_id, created_at);

-- Add indexes for cards table (pricing and search queries)
CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards(set_id);
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
CREATE INDEX IF NOT EXISTS idx_cards_price ON cards(cardmarket_avg_sell_price) WHERE cardmarket_avg_sell_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_name_search ON cards USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_cards_types ON cards USING gin(types);

-- Add indexes for profiles table (user lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active) WHERE last_active IS NOT NULL;

-- Add indexes for sets table (series and release date queries)
CREATE INDEX IF NOT EXISTS idx_sets_series ON sets(series);
CREATE INDEX IF NOT EXISTS idx_sets_release_date ON sets(release_date);
CREATE INDEX IF NOT EXISTS idx_sets_series_release ON sets(series, release_date);

-- Add indexes for friendships table (social features)
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_status ON friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status ON friendships(addressee_id, status);

-- Add indexes for wishlists table
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_card_id ON wishlists(card_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_priority ON wishlists(user_id, priority);

-- Add indexes for user_achievements table
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON user_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);

-- Add indexes for trades table
CREATE INDEX IF NOT EXISTS idx_trades_initiator ON trades(initiator_id);
CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trades(recipient_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);

-- Add indexes for trade_items table
CREATE INDEX IF NOT EXISTS idx_trade_items_trade_id ON trade_items(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_items_user_id ON trade_items(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_items_card_id ON trade_items(card_id);

-- Create a function for optimized community stats (RPC)
CREATE OR REPLACE FUNCTION get_community_collection_stats()
RETURNS TABLE (
  total_collections BIGINT,
  total_cards BIGINT,
  total_value NUMERIC,
  average_size NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT 
      uc.user_id,
      SUM(uc.quantity) as user_cards,
      SUM(uc.quantity * COALESCE(c.cardmarket_avg_sell_price, 0)) as user_value
    FROM user_collections uc
    LEFT JOIN cards c ON uc.card_id = c.id
    GROUP BY uc.user_id
  )
  SELECT 
    COUNT(*)::BIGINT as total_collections,
    COALESCE(SUM(user_cards), 0)::BIGINT as total_cards,
    COALESCE(SUM(user_value), 0)::NUMERIC as total_value,
    CASE 
      WHEN COUNT(*) > 0 THEN COALESCE(SUM(user_cards), 0)::NUMERIC / COUNT(*)::NUMERIC
      ELSE 0::NUMERIC
    END as average_size
  FROM user_stats;
END;
$$;

-- Create a function for getting trending cards efficiently
CREATE OR REPLACE FUNCTION get_trending_cards(days_back INTEGER DEFAULT 7, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  card_id TEXT,
  card_name TEXT,
  set_name TEXT,
  image_small TEXT,
  owners_count BIGINT,
  total_quantity BIGINT,
  average_value NUMERIC,
  rarity TEXT,
  recent_adds BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as card_id,
    c.name as card_name,
    s.name as set_name,
    c.image_small,
    COUNT(DISTINCT uc.user_id)::BIGINT as owners_count,
    SUM(uc.quantity)::BIGINT as total_quantity,
    COALESCE(c.cardmarket_avg_sell_price, 0)::NUMERIC as average_value,
    c.rarity,
    SUM(uc.quantity)::BIGINT as recent_adds
  FROM user_collections uc
  JOIN cards c ON uc.card_id = c.id
  JOIN sets s ON c.set_id = s.id
  WHERE uc.created_at >= NOW() - INTERVAL '%s days' % days_back
  GROUP BY c.id, c.name, s.name, c.image_small, c.cardmarket_avg_sell_price, c.rarity
  ORDER BY recent_adds DESC
  LIMIT limit_count;
END;
$$;

-- Create a function for getting popular sets efficiently
CREATE OR REPLACE FUNCTION get_popular_sets(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  set_id TEXT,
  set_name TEXT,
  set_symbol_url TEXT,
  collectors_count BIGINT,
  total_cards_owned BIGINT,
  average_completion NUMERIC,
  release_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as set_id,
    s.name as set_name,
    s.symbol_url as set_symbol_url,
    COUNT(DISTINCT uc.user_id)::BIGINT as collectors_count,
    SUM(uc.quantity)::BIGINT as total_cards_owned,
    CASE 
      WHEN s.total_cards > 0 AND COUNT(DISTINCT uc.user_id) > 0 
      THEN (SUM(uc.quantity)::NUMERIC / (COUNT(DISTINCT uc.user_id) * s.total_cards)) * 100
      ELSE 0::NUMERIC
    END as average_completion,
    s.release_date::DATE
  FROM sets s
  LEFT JOIN cards c ON s.id = c.set_id
  LEFT JOIN user_collections uc ON c.id = uc.card_id
  GROUP BY s.id, s.name, s.symbol_url, s.total_cards, s.release_date
  HAVING COUNT(DISTINCT uc.user_id) > 0
  ORDER BY collectors_count DESC
  LIMIT limit_count;
END;
$$;

-- Add comments for documentation
COMMENT ON INDEX idx_user_collections_user_id IS 'Optimizes user collection queries';
COMMENT ON INDEX idx_user_collections_user_card IS 'Optimizes user-card lookup queries';
COMMENT ON INDEX idx_cards_price IS 'Optimizes price-based sorting and filtering';
COMMENT ON INDEX idx_cards_name_search IS 'Enables full-text search on card names';
COMMENT ON FUNCTION get_community_collection_stats() IS 'Efficiently calculates community collection statistics';
COMMENT ON FUNCTION get_trending_cards(INTEGER, INTEGER) IS 'Returns trending cards based on recent additions';
COMMENT ON FUNCTION get_popular_sets(INTEGER) IS 'Returns most popular sets by collector count';