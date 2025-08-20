-- Create table to track daily user activity
CREATE TABLE IF NOT EXISTS user_daily_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activities JSONB DEFAULT '{}', -- Store different activity types and counts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Ensure one record per user per day
    UNIQUE(user_id, activity_date)
);

-- Create table to track user streaks
CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    streak_type VARCHAR(50) NOT NULL, -- 'login', 'collection_add', 'trade', etc.
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    streak_start_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Ensure one record per user per streak type
    UNIQUE(user_id, streak_type)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_daily_activity_user_date ON user_daily_activity(user_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_daily_activity_date ON user_daily_activity(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_type ON user_streaks(user_id, streak_type);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC);

-- Create function to update daily activity
CREATE OR REPLACE FUNCTION update_daily_activity(
    p_user_id UUID,
    p_activity_type VARCHAR(50),
    p_increment INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_activities JSONB;
BEGIN
    -- Insert or update daily activity record
    INSERT INTO user_daily_activity (user_id, activity_date, activities)
    VALUES (p_user_id, v_today, jsonb_build_object(p_activity_type, p_increment))
    ON CONFLICT (user_id, activity_date)
    DO UPDATE SET
        activities = COALESCE(user_daily_activity.activities, '{}'::jsonb) || 
                    jsonb_build_object(p_activity_type, 
                        COALESCE((user_daily_activity.activities->>p_activity_type)::integer, 0) + p_increment),
        updated_at = now();
END;
$$;

-- Create function to update user streaks
CREATE OR REPLACE FUNCTION update_user_streak(
    p_user_id UUID,
    p_streak_type VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_current_streak INTEGER := 0;
    v_longest_streak INTEGER := 0;
    v_last_activity_date DATE;
    v_streak_start_date DATE;
BEGIN
    -- Get current streak data
    SELECT current_streak, longest_streak, last_activity_date, streak_start_date
    INTO v_current_streak, v_longest_streak, v_last_activity_date, v_streak_start_date
    FROM user_streaks
    WHERE user_id = p_user_id AND streak_type = p_streak_type;
    
    -- If no record exists, create initial streak
    IF NOT FOUND THEN
        INSERT INTO user_streaks (user_id, streak_type, current_streak, longest_streak, last_activity_date, streak_start_date)
        VALUES (p_user_id, p_streak_type, 1, 1, v_today, v_today);
        RETURN;
    END IF;
    
    -- If activity already recorded today, do nothing
    IF v_last_activity_date = v_today THEN
        RETURN;
    END IF;
    
    -- Check if streak continues (activity was yesterday)
    IF v_last_activity_date = v_yesterday THEN
        -- Continue streak
        v_current_streak := v_current_streak + 1;
        -- Keep existing streak_start_date
    ELSE
        -- Reset streak
        v_current_streak := 1;
        v_streak_start_date := v_today;
    END IF;
    
    -- Update longest streak if current exceeds it
    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;
    
    -- Update the streak record
    UPDATE user_streaks
    SET 
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_activity_date = v_today,
        streak_start_date = v_streak_start_date,
        updated_at = now()
    WHERE user_id = p_user_id AND streak_type = p_streak_type;
END;
$$;

-- Create function to get user streak stats
CREATE OR REPLACE FUNCTION get_user_streak_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB := '{}'::jsonb;
    v_streak_record RECORD;
BEGIN
    -- Get all streak types for the user
    FOR v_streak_record IN
        SELECT streak_type, current_streak, longest_streak, last_activity_date
        FROM user_streaks
        WHERE user_id = p_user_id
    LOOP
        v_result := v_result || jsonb_build_object(
            v_streak_record.streak_type,
            jsonb_build_object(
                'current', v_streak_record.current_streak,
                'longest', v_streak_record.longest_streak,
                'last_date', v_streak_record.last_activity_date
            )
        );
    END LOOP;
    
    RETURN v_result;
END;
$$;

-- Create function to get daily activity stats
CREATE OR REPLACE FUNCTION get_user_daily_activity_stats(
    p_user_id UUID,
    p_days_back INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB := '{}'::jsonb;
    v_total_days INTEGER := 0;
    v_activity_record RECORD;
    v_activity_totals JSONB := '{}'::jsonb;
BEGIN
    -- Count total active days in the period
    SELECT COUNT(*)
    INTO v_total_days
    FROM user_daily_activity
    WHERE user_id = p_user_id
      AND activity_date >= CURRENT_DATE - INTERVAL '1 day' * p_days_back;
    
    -- Get activity totals
    FOR v_activity_record IN
        SELECT key, SUM((value)::integer) as total
        FROM user_daily_activity,
             jsonb_each_text(activities)
        WHERE user_id = p_user_id
          AND activity_date >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
        GROUP BY key
    LOOP
        v_activity_totals := v_activity_totals || jsonb_build_object(
            v_activity_record.key, v_activity_record.total
        );
    END LOOP;
    
    v_result := jsonb_build_object(
        'total_active_days', v_total_days,
        'activity_totals', v_activity_totals,
        'period_days', p_days_back
    );
    
    RETURN v_result;
END;
$$;

-- Grant permissions
GRANT ALL ON user_daily_activity TO authenticated;
GRANT ALL ON user_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION update_daily_activity TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_streak_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_daily_activity_stats TO authenticated;

-- Enable RLS
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own daily activity" 
    ON user_daily_activity FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily activity" 
    ON user_daily_activity FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily activity" 
    ON user_daily_activity FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own streaks" 
    ON user_streaks FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streaks" 
    ON user_streaks FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks" 
    ON user_streaks FOR UPDATE 
    USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE user_daily_activity IS 'Tracks daily user activities for streak calculations and activity-based achievements';
COMMENT ON TABLE user_streaks IS 'Tracks current and longest streaks for different activity types';
COMMENT ON FUNCTION update_daily_activity IS 'Updates daily activity count for a specific activity type';
COMMENT ON FUNCTION update_user_streak IS 'Updates user streak for a specific streak type';
COMMENT ON FUNCTION get_user_streak_stats IS 'Returns all streak statistics for a user';
COMMENT ON FUNCTION get_user_daily_activity_stats IS 'Returns daily activity statistics for a user over a specified period';