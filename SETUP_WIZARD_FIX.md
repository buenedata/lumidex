# Setup Wizard Always Showing - Fix Guide

## Problem
The setup wizard appears every time you visit `localhost:3000`, even after completing it. This happens because the database is missing required columns that track setup completion.

## Root Cause
The main `supabase/schema.sql` file was missing these essential columns in the `profiles` table:
- `setup_completed` (BOOLEAN) - tracks if user completed setup
- `setup_completed_at` (TIMESTAMPTZ) - when setup was completed  
- `preferred_price_source` (TEXT) - user's price source preference

The application code expects these columns to exist, but they were only available in separate migration scripts that may not have been run.

## Solution Options

### Option 1: Quick Fix (Recommended)
Run the migration script to add missing columns to your existing database:

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `scripts/fix-setup-wizard-columns.sql`
4. Click "Run"

This safely adds the missing columns without affecting existing data.

### Option 2: Fresh Database Setup
If you want to start fresh or don't have important data:

1. Open your Supabase project dashboard
2. Go to SQL Editor  
3. Copy and paste the entire `supabase/schema.sql` file
4. Click "Run"

**⚠️ WARNING: This will delete ALL existing data!**

## What Was Fixed

### Updated Files:
1. **`supabase/schema.sql`** - Added missing columns to the main schema
2. **`scripts/fix-setup-wizard-columns.sql`** - New migration script for existing databases

### Added Columns:
```sql
-- In profiles table:
preferred_price_source TEXT DEFAULT 'cardmarket' CHECK (preferred_price_source IN ('cardmarket', 'tcgplayer')),
setup_completed BOOLEAN DEFAULT false,
setup_completed_at TIMESTAMPTZ,
```

## How It Works

1. **Setup Detection**: `src/app/page.tsx` checks `setup_completed` field
2. **Setup Completion**: `src/components/setup/SetupWizard.tsx` sets `setup_completed = true`
3. **Redirect Logic**: If `setup_completed` is `true`, user goes to dashboard; if `false`, goes to setup

## Verification

After running the fix:

1. Visit `localhost:3000`
2. Complete the setup wizard
3. You should be redirected to the dashboard
4. Visiting `localhost:3000` again should go directly to dashboard (no setup wizard)

## Related Files

- `src/app/page.tsx` - Main page with setup detection logic
- `src/app/setup/page.tsx` - Setup page component
- `src/components/setup/SetupWizard.tsx` - Setup wizard component
- `supabase/schema.sql` - Main database schema
- `scripts/fix-setup-wizard-columns.sql` - Migration fix script