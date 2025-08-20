-- Fix RLS policies for user_achievements table to ensure achievements can be unlocked

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can insert their own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can update their own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can delete their own achievements" ON user_achievements;

-- Create proper RLS policies for user_achievements
CREATE POLICY "Users can view their own achievements" 
    ON user_achievements FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" 
    ON user_achievements FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements" 
    ON user_achievements FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own achievements" 
    ON user_achievements FOR DELETE 
    USING (auth.uid() = user_id);

-- Allow service role to bypass RLS for achievement checking
DROP POLICY IF EXISTS "Service role can manage all achievements" ON user_achievements;
CREATE POLICY "Service role can manage all achievements"
    ON user_achievements FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Ensure RLS is enabled
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Create a function to check and unlock achievements with elevated privileges
CREATE OR REPLACE FUNCTION check_and_unlock_achievements(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_result JSON := '{"unlocked": [], "errors": []}'::json;
    v_unlocked_achievements UUID[] := ARRAY[]::UUID[];
    v_errors TEXT[] := ARRAY[]::TEXT[];
    achievement_record RECORD;
    user_stats RECORD;
BEGIN
    -- Get user's collection stats
    SELECT 
        COUNT(DISTINCT uc.card_id) as unique_cards,
        COUNT(*) as total_cards,
        COALESCE(SUM(uc.quantity * COALESCE(c.cardmarket_avg_sell_price, 0)), 0) as collection_value_eur
    INTO user_stats
    FROM user_collections uc
    LEFT JOIN cards c ON uc.card_id = c.id
    WHERE uc.user_id = p_user_id;

    -- Check basic collection achievements
    -- First card achievement
    IF user_stats.total_cards >= 1 THEN
        INSERT INTO user_achievements (user_id, achievement_type, achievement_data, unlocked_at)
        VALUES (p_user_id, 'first_card', '{"points": 10}', now())
        ON CONFLICT (user_id, achievement_type) DO NOTHING;
        
        IF FOUND THEN
            v_unlocked_achievements := array_append(v_unlocked_achievements, 'first_card'::UUID);
        END IF;
    END IF;

    -- Card Enthusiast (25 unique cards)
    IF user_stats.unique_cards >= 25 THEN
        INSERT INTO user_achievements (user_id, achievement_type, achievement_data, unlocked_at)
        VALUES (p_user_id, 'collector_25', '{"points": 50}', now())
        ON CONFLICT (user_id, achievement_type) DO NOTHING;
        
        IF FOUND THEN
            v_unlocked_achievements := array_append(v_unlocked_achievements, 'collector_25'::UUID);
        END IF;
    END IF;

    -- Master Collector (250 unique cards)
    IF user_stats.unique_cards >= 250 THEN
        INSERT INTO user_achievements (user_id, achievement_type, achievement_data, unlocked_at)
        VALUES (p_user_id, 'collector_250', '{"points": 500}', now())
        ON CONFLICT (user_id, achievement_type) DO NOTHING;
        
        IF FOUND THEN
            v_unlocked_achievements := array_append(v_unlocked_achievements, 'collector_250'::UUID);
        END IF;
    END IF;

    -- Add more achievement checks here...

    -- Build result
    v_result := json_build_object(
        'unlocked', array_to_json(v_unlocked_achievements),
        'errors', array_to_json(v_errors),
        'user_stats', row_to_json(user_stats)
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, SQLERRM);
    v_result := json_build_object(
        'unlocked', array_to_json(v_unlocked_achievements),
        'errors', array_to_json(v_errors)
    );
    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_and_unlock_achievements TO authenticated;

-- Drop existing functions if they exist with different signatures
DROP FUNCTION IF EXISTS unlock_user_achievement(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS unlock_user_achievement(UUID, TEXT);
DROP FUNCTION IF EXISTS delete_user_achievement(UUID, TEXT);

-- Function to unlock a specific achievement (what the achievement service needs)
CREATE OR REPLACE FUNCTION unlock_user_achievement(
  p_user_id UUID,
  p_achievement_type TEXT,
  p_achievement_data JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  rec_id UUID,
  rec_user_id UUID,
  rec_achievement_type TEXT,
  rec_achievement_data JSONB,
  rec_unlocked_at TIMESTAMPTZ,
  rec_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert the achievement, ignoring conflicts (in case it already exists)
  INSERT INTO user_achievements (user_id, achievement_type, achievement_data, unlocked_at)
  VALUES (p_user_id, p_achievement_type, p_achievement_data, NOW())
  ON CONFLICT (user_id, achievement_type) DO NOTHING;
  
  -- Return the achievement record with renamed columns to avoid ambiguity
  RETURN QUERY
  SELECT
    ua.id,
    ua.user_id,
    ua.achievement_type,
    ua.achievement_data,
    ua.unlocked_at,
    ua.created_at
  FROM user_achievements ua
  WHERE ua.user_id = p_user_id AND ua.achievement_type = p_achievement_type;
END;
$$;

-- Grant execute permission for the new function
GRANT EXECUTE ON FUNCTION unlock_user_achievement TO authenticated;

-- Function to delete a specific achievement
CREATE OR REPLACE FUNCTION delete_user_achievement(
  p_user_id UUID,
  p_achievement_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM user_achievements
  WHERE user_id = p_user_id AND achievement_type = p_achievement_type;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission for the delete function
GRANT EXECUTE ON FUNCTION delete_user_achievement TO authenticated;

-- Add unique constraint to prevent duplicate achievements (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_achievements_user_achievement_unique'
    ) THEN
        ALTER TABLE user_achievements
        ADD CONSTRAINT user_achievements_user_achievement_unique
        UNIQUE (user_id, achievement_type);
    END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION check_and_unlock_achievements IS 'Checks and unlocks achievements for a user with elevated privileges to bypass RLS';
COMMENT ON FUNCTION unlock_user_achievement IS 'Unlocks a specific achievement for a user with elevated privileges';
COMMENT ON FUNCTION delete_user_achievement IS 'Deletes a specific achievement for a user with elevated privileges';
COMMENT ON TABLE user_achievements IS 'Stores unlocked achievements for users with proper RLS policies';