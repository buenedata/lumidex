-- Create function to get community achievements data with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION get_community_achievements_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    total_value NUMERIC := 0;
    total_cards INTEGER := 0;
    total_users INTEGER := 0;
    unique_cards INTEGER := 0;
BEGIN
    -- Calculate total collection value across all users
    SELECT 
        COALESCE(SUM(uc.quantity * COALESCE(c.cardmarket_avg_sell_price, 0)), 0),
        COALESCE(SUM(uc.quantity), 0)
    INTO total_value, total_cards
    FROM user_collections uc
    LEFT JOIN cards c ON uc.card_id = c.id;
    
    -- Get total number of users with collections
    SELECT COUNT(DISTINCT user_id)
    INTO total_users
    FROM user_collections;
    
    -- Get number of unique cards in community
    SELECT COUNT(DISTINCT card_id)
    INTO unique_cards
    FROM user_collections;
    
    -- Build result JSON
    result := json_build_object(
        'totalValue', total_value,
        'totalCards', total_cards,
        'totalUsers', total_users,
        'uniqueCards', unique_cards
    );
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_community_achievements_data() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_community_achievements_data() IS 'Returns community-wide statistics for achievements, bypassing RLS restrictions';