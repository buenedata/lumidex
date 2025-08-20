-- Create wanted_board table
CREATE TABLE IF NOT EXISTS wanted_board (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL,
    max_price_eur DECIMAL(10,2),
    condition_preference TEXT NOT NULL DEFAULT 'any' CHECK (condition_preference IN ('any', 'mint', 'near_mint', 'lightly_played', 'moderately_played')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user can only have one post per card
    UNIQUE(user_id, card_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wanted_board_user_id ON wanted_board(user_id);
CREATE INDEX IF NOT EXISTS idx_wanted_board_card_id ON wanted_board(card_id);
CREATE INDEX IF NOT EXISTS idx_wanted_board_created_at ON wanted_board(created_at DESC);

-- Enable RLS
ALTER TABLE wanted_board ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all wanted board posts" ON wanted_board
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own wanted board posts" ON wanted_board
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wanted board posts" ON wanted_board
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wanted board posts" ON wanted_board
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wanted_board_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_wanted_board_updated_at
    BEFORE UPDATE ON wanted_board
    FOR EACH ROW
    EXECUTE FUNCTION update_wanted_board_updated_at();