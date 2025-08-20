-- Final fix: Variant-aware duplicate calculation with proper SQL syntax and RLS bypass
DROP FUNCTION IF EXISTS get_leaderboards_data();

CREATE OR REPLACE FUNCTION get_leaderboards_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Temporarily disable RLS for this function
    PERFORM set_config('row_security', 'off', true);
    
    -- Calculate user statistics with variant pricing
    WITH user_card_variants AS (
        SELECT
            uc.user_id,
            uc.card_id,
            COALESCE(uc.variant, 'normal') as variant,
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
        WHERE p.username IS NOT NULL
        GROUP BY uc.user_id, uc.card_id, COALESCE(uc.variant, 'normal'), c.id, c.name,
                 c.cardmarket_avg_sell_price, c.cardmarket_low_price, c.cardmarket_trend_price,
                 c.cardmarket_reverse_holo_sell, c.cardmarket_reverse_holo_low, c.cardmarket_reverse_holo_trend,
                 c.rarity, p.username, p.display_name, p.avatar_url
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
            SUM(CASE WHEN rarity IN ('Rare', 'Ultra Rare', 'Secret Rare', 'Rainbow Rare') THEN quantity ELSE 0 END) as rare_cards,
            -- CORRECT DUPLICATE CALCULATION: Count duplicates per variant, then sum
            SUM(CASE WHEN quantity > 1 THEN quantity - 1 ELSE 0 END) as duplicate_cards_per_variant,
            SUM(CASE WHEN last_added > NOW() - INTERVAL '30 days' THEN quantity ELSE 0 END) as recent_activity
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
            -- CORRECT: Sum all variant duplicates across all cards
            SUM(duplicate_cards_per_variant) as total_duplicate_cards,
            SUM(recent_activity) as total_recent_activity,
            MAX(single_card_value) as most_valuable_card_price
        FROM user_card_values
        GROUP BY user_id, username, display_name, avatar_url
    ),
    user_stats_with_card_names AS (
        SELECT 
            us.*,
            ucv.card_name as most_valuable_card_name
        FROM user_stats us
        LEFT JOIN user_card_values ucv ON us.user_id = ucv.user_id 
            AND us.most_valuable_card_price = ucv.single_card_value
    ),
    -- Pre-calculate ranks to avoid window functions in aggregates
    ranked_top_collectors AS (
        SELECT 
            user_id, username, display_name, avatar_url, total_value, total_cards, unique_cards,
            ROW_NUMBER() OVER (ORDER BY total_value DESC) as rank
        FROM user_stats_with_card_names
        WHERE total_value > 0
        ORDER BY total_value DESC
        LIMIT 20
    ),
    ranked_biggest_collections AS (
        SELECT 
            user_id, username, display_name, avatar_url, total_cards, unique_cards, total_value,
            ROW_NUMBER() OVER (ORDER BY total_cards DESC) as rank
        FROM user_stats_with_card_names
        WHERE total_cards > 0
        ORDER BY total_cards DESC
        LIMIT 20
    ),
    ranked_most_valuable AS (
        SELECT 
            user_id, username, display_name, avatar_url, most_valuable_card_price, most_valuable_card_name, total_cards, unique_cards, total_value,
            ROW_NUMBER() OVER (ORDER BY most_valuable_card_price DESC) as rank
        FROM user_stats_with_card_names
        WHERE most_valuable_card_price > 0
        ORDER BY most_valuable_card_price DESC
        LIMIT 20
    ),
    ranked_duplicate_collectors AS (
        SELECT 
            user_id, username, display_name, avatar_url, total_duplicate_cards, total_cards, unique_cards,
            ROW_NUMBER() OVER (ORDER BY total_duplicate_cards DESC) as rank
        FROM user_stats_with_card_names
        -- CRITICAL FIX: Only include users who actually have duplicate cards
        WHERE total_duplicate_cards > 0
        ORDER BY total_duplicate_cards DESC
        LIMIT 20
    ),
    ranked_recently_active AS (
        SELECT 
            user_id, username, display_name, avatar_url, total_recent_activity, total_cards,
            ROW_NUMBER() OVER (ORDER BY total_recent_activity DESC) as rank
        FROM user_stats_with_card_names
        WHERE total_recent_activity > 0
        ORDER BY total_recent_activity DESC
        LIMIT 20
    )
    SELECT json_build_object(
        'topCollectors', (
            SELECT json_agg(
                json_build_object(
                    'userId', user_id,
                    'username', username,
                    'displayName', display_name,
                    'avatarUrl', avatar_url,
                    'value', ROUND(total_value::numeric, 2),
                    'rank', rank,
                    'metadata', json_build_object(
                        'totalCards', total_cards,
                        'uniqueCards', unique_cards,
                        'totalValue', ROUND(total_value::numeric, 2)
                    )
                )
            ) 
            FROM ranked_top_collectors
        ),
        'biggestCollections', (
            SELECT json_agg(
                json_build_object(
                    'userId', user_id,
                    'username', username,
                    'displayName', display_name,
                    'avatarUrl', avatar_url,
                    'value', total_cards,
                    'rank', rank,
                    'metadata', json_build_object(
                        'totalCards', total_cards,
                        'uniqueCards', unique_cards,
                        'totalValue', ROUND(total_value::numeric, 2)
                    )
                )
            )
            FROM ranked_biggest_collections
        ),
        'mostValuable', (
            SELECT json_agg(
                json_build_object(
                    'userId', user_id,
                    'username', username,
                    'displayName', display_name,
                    'avatarUrl', avatar_url,
                    'value', ROUND(most_valuable_card_price::numeric, 2),
                    'rank', rank,
                    'metadata', json_build_object(
                        'totalCards', total_cards,
                        'uniqueCards', unique_cards,
                        'totalValue', ROUND(total_value::numeric, 2),
                        'mostValuableCardName', most_valuable_card_name
                    )
                )
            )
            FROM ranked_most_valuable
        ),
        'duplicateCollectors', (
            SELECT json_agg(
                json_build_object(
                    'userId', user_id,
                    'username', username,
                    'displayName', display_name,
                    'avatarUrl', avatar_url,
                    'value', total_duplicate_cards,
                    'rank', rank,
                    'metadata', json_build_object(
                        'totalCards', total_cards,
                        'uniqueCards', unique_cards,
                        'duplicateCards', total_duplicate_cards
                    )
                )
            )
            FROM ranked_duplicate_collectors
        ),
        'setCompletionists', '[]'::json,
        'recentlyActive', (
            SELECT json_agg(
                json_build_object(
                    'userId', user_id,
                    'username', username,
                    'displayName', display_name,
                    'avatarUrl', avatar_url,
                    'value', total_recent_activity,
                    'rank', rank,
                    'metadata', json_build_object(
                        'totalCards', total_cards,
                        'recentActivity', total_recent_activity
                    )
                )
            )
            FROM ranked_recently_active
        )
    ) INTO result;
    
    -- Re-enable RLS
    PERFORM set_config('row_security', 'on', true);
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_leaderboards_data() TO authenticated;