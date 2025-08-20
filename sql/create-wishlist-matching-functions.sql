-- Create functions for wishlist matching that bypass RLS

-- Function to get cards I want that my friends have
CREATE OR REPLACE FUNCTION get_cards_i_want_friends_have(user_id_param UUID)
RETURNS TABLE (
  card_id TEXT,
  card_name TEXT,
  card_image_small TEXT,
  card_price DECIMAL,
  card_rarity TEXT,
  card_number TEXT,
  set_id TEXT,
  set_name TEXT,
  friend_id UUID,
  friend_username TEXT,
  friend_display_name TEXT,
  friend_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as card_id,
    c.name as card_name,
    c.image_small as card_image_small,
    c.cardmarket_avg_sell_price as card_price,
    c.rarity as card_rarity,
    c.number as card_number,
    s.id as set_id,
    s.name as set_name,
    uc.user_id as friend_id,
    p.username as friend_username,
    p.display_name as friend_display_name,
    p.avatar_url as friend_avatar_url
  FROM wishlists w
  JOIN cards c ON w.card_id = c.id
  JOIN sets s ON c.set_id = s.id
  JOIN user_collections uc ON uc.card_id = c.id AND uc.quantity > 0
  JOIN profiles p ON uc.user_id = p.id
  JOIN friendships f ON (
    (f.requester_id = user_id_param AND f.addressee_id = uc.user_id) OR
    (f.addressee_id = user_id_param AND f.requester_id = uc.user_id)
  )
  WHERE w.user_id = user_id_param
    AND f.status = 'accepted'
    AND uc.user_id != user_id_param
  ORDER BY c.name;
END;
$$;

-- Function to get cards my friends want that I have
CREATE OR REPLACE FUNCTION get_cards_friends_want_i_have(user_id_param UUID)
RETURNS TABLE (
  card_id TEXT,
  card_name TEXT,
  card_image_small TEXT,
  card_price DECIMAL,
  card_rarity TEXT,
  card_number TEXT,
  set_id TEXT,
  set_name TEXT,
  friend_id UUID,
  friend_username TEXT,
  friend_display_name TEXT,
  friend_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as card_id,
    c.name as card_name,
    c.image_small as card_image_small,
    c.cardmarket_avg_sell_price as card_price,
    c.rarity as card_rarity,
    c.number as card_number,
    s.id as set_id,
    s.name as set_name,
    w.user_id as friend_id,
    p.username as friend_username,
    p.display_name as friend_display_name,
    p.avatar_url as friend_avatar_url
  FROM user_collections uc
  JOIN cards c ON uc.card_id = c.id
  JOIN sets s ON c.set_id = s.id
  JOIN wishlists w ON w.card_id = c.id
  JOIN profiles p ON w.user_id = p.id
  JOIN friendships f ON (
    (f.requester_id = user_id_param AND f.addressee_id = w.user_id) OR
    (f.addressee_id = user_id_param AND f.requester_id = w.user_id)
  )
  WHERE uc.user_id = user_id_param
    AND uc.quantity > 0
    AND f.status = 'accepted'
    AND w.user_id != user_id_param
  ORDER BY c.name;
END;
$$;

-- Function to get wishlist matching summary
CREATE OR REPLACE FUNCTION get_wishlist_matching_summary(user_id_param UUID)
RETURNS TABLE (
  total_matches INTEGER,
  i_want_they_have INTEGER,
  they_want_i_have INTEGER,
  friend_id UUID,
  friend_username TEXT,
  friend_display_name TEXT,
  friend_avatar_url TEXT,
  friend_match_count INTEGER,
  friend_i_want_count INTEGER,
  friend_they_want_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH i_want_matches AS (
    SELECT 
      uc.user_id as friend_id,
      COUNT(*) as match_count
    FROM wishlists w
    JOIN user_collections uc ON w.card_id = uc.card_id AND uc.quantity > 0
    JOIN friendships f ON (
      (f.requester_id = user_id_param AND f.addressee_id = uc.user_id) OR
      (f.addressee_id = user_id_param AND f.requester_id = uc.user_id)
    )
    WHERE w.user_id = user_id_param
      AND f.status = 'accepted'
      AND uc.user_id != user_id_param
    GROUP BY uc.user_id
  ),
  they_want_matches AS (
    SELECT 
      w.user_id as friend_id,
      COUNT(*) as match_count
    FROM user_collections uc
    JOIN wishlists w ON uc.card_id = w.card_id
    JOIN friendships f ON (
      (f.requester_id = user_id_param AND f.addressee_id = w.user_id) OR
      (f.addressee_id = user_id_param AND f.requester_id = w.user_id)
    )
    WHERE uc.user_id = user_id_param
      AND uc.quantity > 0
      AND f.status = 'accepted'
      AND w.user_id != user_id_param
    GROUP BY w.user_id
  ),
  friend_totals AS (
    SELECT 
      COALESCE(iwm.friend_id, twm.friend_id) as friend_id,
      COALESCE(iwm.match_count, 0) as i_want_count,
      COALESCE(twm.match_count, 0) as they_want_count,
      COALESCE(iwm.match_count, 0) + COALESCE(twm.match_count, 0) as total_count
    FROM i_want_matches iwm
    FULL OUTER JOIN they_want_matches twm ON iwm.friend_id = twm.friend_id
  )
  SELECT 
    (SELECT SUM(total_count)::INTEGER FROM friend_totals) as total_matches,
    (SELECT SUM(i_want_count)::INTEGER FROM friend_totals) as i_want_they_have,
    (SELECT SUM(they_want_count)::INTEGER FROM friend_totals) as they_want_i_have,
    ft.friend_id,
    p.username as friend_username,
    p.display_name as friend_display_name,
    p.avatar_url as friend_avatar_url,
    ft.total_count::INTEGER as friend_match_count,
    ft.i_want_count::INTEGER as friend_i_want_count,
    ft.they_want_count::INTEGER as friend_they_want_count
  FROM friend_totals ft
  JOIN profiles p ON ft.friend_id = p.id
  WHERE ft.total_count > 0
  ORDER BY ft.total_count DESC
  LIMIT 10;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_cards_i_want_friends_have(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cards_friends_want_i_have(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_wishlist_matching_summary(UUID) TO authenticated;