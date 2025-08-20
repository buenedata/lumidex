-- Update functions for wishlist matching to include large images

-- Function to get cards I want that my friends have
CREATE OR REPLACE FUNCTION get_cards_i_want_friends_have(user_id_param UUID)
RETURNS TABLE (
  card_id TEXT,
  card_name TEXT,
  card_image_small TEXT,
  card_image_large TEXT,
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
    c.image_large as card_image_large,
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
  card_image_large TEXT,
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
    c.image_large as card_image_large,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_cards_i_want_friends_have(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cards_friends_want_i_have(UUID) TO authenticated;