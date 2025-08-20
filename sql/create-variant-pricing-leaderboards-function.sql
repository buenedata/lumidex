-- Drop the existing function that uses old pricing logic
DROP FUNCTION IF EXISTS get_leaderboards_data();

-- Create new function that uses variant pricing logic
CREATE OR REPLACE FUNCTION get_leaderboards_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    top_collectors JSON;
    biggest_collections JSON;
    most_valuable JSON;
    duplicate_collectors JSON;
    recently_active JSON;
BEGIN
    -- Calculate user statistics with variant pricing
    WITH user_card_variants AS (
        SELECT 
            uc.user_id,
            uc.card_id,
            uc.variant,
            SUM(uc.quantity) as quantity,
            c.name as card_name,
            c.cardmarket_avg_sell_price,
            c.cardmarket_low_price,
            c.cardmarket_trend_price,
            c.cardmarket_reverse_holo_sell,
            c.cardmarket_reverse_holo_low,
            c.cardmarket_reverse_holo_trend,
            c.rarity,
            p.username,
            p.display_name,
            p.avatar_url,
            MIN(uc.created_at) as first_added,
            MAX(uc.created_at) as last_added
        FROM user_collections uc
        JOIN cards c ON uc.card_id = c.id
        JOIN profiles p ON uc.user_id = p.id
        GROUP BY uc.user_id, uc.card_id, uc.variant, c.name, c.cardmarket_avg_sell_price, 
                 c.cardmarket_low_price, c.cardmarket_trend_price, c.cardmarket_reverse_holo_sell,
                 c.cardmarket_reverse_holo_low, c.cardmarket_reverse_holo_trend, c.rarity,
                 p.username, p.display_name, p.avatar_url
    ),
    user_card_values AS (
        SELECT 
            user_id,
            card_id,
            card_name,
            username,
            display_name,
            avatar_url,
            SUM(quantity) as total_quantity,
            -- Calculate variant-specific pricing
            SUM(
                CASE 
                    WHEN variant = 'reverse_holo' AND cardmarket_reverse_holo_sell > 0 
                    THEN quantity * cardmarket_reverse_holo_sell
                    WHEN variant = 'reverse_holo' AND cardmarket_reverse_holo_low > 0 
                    THEN quantity * cardmarket_reverse_holo_low
                    WHEN variant = 'reverse_holo' AND cardmarket_reverse_holo_trend > 0 
                    THEN quantity * cardmarket_reverse_holo_trend
                    WHEN cardmarket_avg_sell_price > 0 
                    THEN quantity * cardmarket_avg_sell_price
                    WHEN cardmarket_low_price > 0 
                    THEN quantity * cardmarket_low_price
                    WHEN cardmarket_trend_price > 0 
                    THEN quantity * cardmarket_trend_price
                    ELSE 0
                END
            ) as card_value,
            MAX(
                CASE 
                    WHEN variant = 'reverse_holo' AND cardmarket_reverse_holo_sell > 0 
                    THEN cardmarket_reverse_holo_sell
                    WHEN variant = 'reverse_holo' AND cardmarket_reverse_holo_low > 0 
                    THEN cardmarket_reverse_holo_low
                    WHEN variant = 'reverse_holo' AND cardmarket_reverse_holo_trend > 0 
                    THEN cardmarket_reverse_holo_trend
                    WHEN cardmarket_avg_sell_price > 0 
                    THEN cardmarket_avg_sell_price
                    WHEN cardmarket_low_price > 0 
                    THEN cardmarket_low_price
                    WHEN cardmarket_trend_price > 0 
                    THEN cardmarket_trend_price
                    ELSE 0
                END
            ) as single_card_value,
            COUNT(DISTINCT variant) as variant_count,
            MAX(CASE WHEN rarity IN ('Rare', 'Ultra Rare', 'Secret Rare', 'Rainbow Rare') THEN quantity ELSE 0 END) as rare_cards,
            MAX(CASE WHEN quantity > 1 THEN quantity - 1 ELSE 0 END) as duplicate_cards,
            MAX(CASE WHEN last_added > NOW() - INTERVAL '30 days' THEN quantity ELSE 0 END) as recent_activity
        FROM user_card_variants
        GROUP BY user_id, card_id, card_name, username, display_name, avatar_url
    ),
    user_stats AS (
        SELECT 
            user_id,
            username,
            display_name,
            avatar_url,
            SUM(total_quantity) as total_cards,
            COUNT(DISTINCT card_id) as unique_cards,
            SUM(card_value) as total_value,
            SUM(rare_cards) as total_rare_cards,
            SUM(duplicate_cards) as total_duplicate_cards,
            SUM(recent_activity) as total_recent_activity,
            MAX(single_card_value) as most_valuable_card_price,
            (SELECT card_name FROM user_card_values ucv2 
             WHERE ucv2.user_id = user_card_values.user_id 
             AND ucv2.single_card_value = MAX(user_card_values.single_card_value) 
             LIMIT 1) as most_valuable_card_name
        FROM user_card_values
        GROUP BY user_id, username, display_name, avatar_url
    )
    
    -- Top Collectors (by total value)
    SELECT json_agg(
        json_build_object(
            'userId', user_id,
            'username', username,
            'displayName', display_name,
            'avatarUrl', avatar_url,
            'value', ROUND(total_value::numeric, 2),
            'rank', row_number() OVER (ORDER BY total_value DESC),
            'metadata', json_build_object(
                'totalCards', total_cards,
                'uniqueCards', unique_cards,
                'totalValue', ROUND(total_value::numeric, 2)
            )
        ) ORDER BY total_value DESC
    ) INTO top_collectors
    FROM user_stats
    WHERE total_value > 0
    LIMIT 20;
    
    -- Biggest Collections (by total cards)
    SELECT json_agg(
        json_build_object(
            'userId', user_id,
            'username', username,
            'displayName', display_name,
            'avatarUrl', avatar_url,
            'value', total_cards,
            'rank', row_number() OVER (ORDER BY total_cards DESC),
            'metadata', json_build_object(
                'totalCards', total_cards,
                'uniqueCards', unique_cards,
                'totalValue', ROUND(total_value::numeric, 2)
            )
        ) ORDER BY total_cards DESC
    ) INTO biggest_collections
    FROM user_stats
    WHERE total_cards > 0
    LIMIT 20;
    
    -- Most Valuable (by single most valuable card)
    SELECT json_agg(
        json_build_object(
            'userId', user_id,
            'username', username,
            'displayName', display_name,
            'avatarUrl', avatar_url,
            'value', ROUND(most_valuable_card_price::numeric, 2),
            'rank', row_number() OVER (ORDER BY most_valuable_card_price DESC),
            'metadata', json_build_object(
                'totalCards', total_cards,
                'uniqueCards', unique_cards,
                'totalValue', ROUND(total_value::numeric, 2),
                'mostValuableCardName', most_valuable_card_name
            )
        ) ORDER BY most_valuable_card_price DESC
    ) INTO most_valuable
    FROM user_stats
    WHERE most_valuable_card_price > 0
    LIMIT 20;
    
    -- Duplicate Collectors (by total duplicate cards)
    SELECT json_agg(
        json_build_object(
            'userId', user_id,
            'username', username,
            'displayName', display_name,
            'avatarUrl', avatar_url,
            'value', total_duplicate_cards,
            'rank', row_number() OVER (ORDER BY total_duplicate_cards DESC),
            'metadata', json_build_object(
                'totalCards', total_cards,
                'uniqueCards', unique_cards,
                'duplicateCards', total_duplicate_cards
            )
        ) ORDER BY total_duplicate_cards DESC
    ) INTO duplicate_collectors
    FROM user_stats
    WHERE total_duplicate_cards > 0
    LIMIT 20;
    
    -- Recently Active (by cards added in last 30 days)
    SELECT json_agg(
        json_build_object(
            'userId', user_id,
            'username', username,
            'displayName', display_name,
            'avatarUrl', avatar_url,
            'value', total_recent_activity,
            'rank', row_number() OVER (ORDER BY total_recent_activity DESC),
            'metadata', json_build_object(
                'totalCards', total_cards,
                'recentActivity', total_recent_activity
            )
        ) ORDER BY total_recent_activity DESC
    ) INTO recently_active
    FROM user_stats
    WHERE total_recent_activity > 0
    LIMIT 20;
    
    -- Combine all results
    SELECT json_build_object(
        'topCollectors', COALESCE(top_collectors, '[]'::json),
        'biggestCollections', COALESCE(biggest_collections, '[]'::json),
        'mostValuable', COALESCE(most_valuable, '[]'::json),
        'duplicateCollectors', COALESCE(duplicate_collectors, '[]'::json),
        'setCompletionists', '[]'::json,  -- Will be handled separately
        'recentlyActive', COALESCE(recently_active, '[]'::json)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_leaderboards_data() TO authenticated;