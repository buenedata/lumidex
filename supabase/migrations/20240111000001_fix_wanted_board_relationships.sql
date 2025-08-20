-- Fix wanted_board table relationships
-- This migration adds proper foreign key constraints to enable Supabase joins

-- First, drop the existing foreign key constraint to auth.users
ALTER TABLE wanted_board DROP CONSTRAINT IF EXISTS wanted_board_user_id_fkey;

-- Add foreign key constraint to profiles table instead of auth.users
ALTER TABLE wanted_board ADD CONSTRAINT wanted_board_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key constraint to cards table
ALTER TABLE wanted_board ADD CONSTRAINT wanted_board_card_id_fkey 
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

-- Update the RLS policies to be more explicit
DROP POLICY IF EXISTS "Users can view all wanted board posts" ON wanted_board;
DROP POLICY IF EXISTS "Users can insert their own wanted board posts" ON wanted_board;
DROP POLICY IF EXISTS "Users can update their own wanted board posts" ON wanted_board;
DROP POLICY IF EXISTS "Users can delete their own wanted board posts" ON wanted_board;

-- Create new RLS policies
CREATE POLICY "Anyone can view wanted board posts" ON wanted_board
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert their own wanted board posts" ON wanted_board
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wanted board posts" ON wanted_board
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wanted board posts" ON wanted_board
    FOR DELETE USING (auth.uid() = user_id);

-- Refresh the schema cache to ensure Supabase recognizes the new relationships
NOTIFY pgrst, 'reload schema';