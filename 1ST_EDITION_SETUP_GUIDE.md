# 1st Edition Pricing Setup Guide

This guide will help you complete the 1st Edition pricing implementation for your Pokemon TCG collection app.

## 🚀 Quick Setup Steps

### 1. Run Database Migration

First, you need to add the new 1st Edition pricing fields to your database:

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy and paste the contents of [`scripts/add-1st-edition-pricing.sql`](scripts/add-1st-edition-pricing.sql)
4. Click **Run** to execute the migration

This will add:
- Missing TCGPlayer variant availability fields
- Dedicated 1st Edition pricing fields (USD from TCGPlayer)
- Performance indexes
- Updates existing WotC/E-Card era cards to mark them as having 1st Edition variants

### 2. Test the Implementation

Run the comprehensive test script to verify everything works:

```bash
# Make sure you're in the project root directory
cd /path/to/pokemon-tcg-collection

# Run the test script
node scripts/test-1st-edition-pricing.js
```

**Note:** The test script will automatically load your `.env.local` file. Make sure you have:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Verify in the UI

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to WotC era cards:**
   - Base Set cards (e.g., Charizard, Blastoise)
   - Jungle, Fossil, Team Rocket cards
   - Gym Heroes/Challenge cards
   - Neo Genesis/Discovery/Revelation/Destiny cards
   - E-Card series cards

3. **Look for green 1st Edition buttons:**
   - Should appear alongside other variant buttons
   - Green color (#4caf50) distinguishes them from other variants

4. **Test collection management:**
   - Click green buttons to add/remove 1st Edition variants
   - Check that quantities update correctly

5. **Verify pricing display:**
   - Open card details modal
   - Look for "1st Edition" pricing sections
   - Should show USD pricing from TCGPlayer when available
   - Should show estimated pricing (2-3x normal) as fallback

## 🎯 What's Been Implemented

### ✅ Frontend Features
- **Green 1st Edition Buttons** - Distinctive styling for easy identification
- **Smart Variant Detection** - Only shows on WotC and E-Card era sets
- **Collection Management** - Full add/remove functionality
- **Pricing Display** - Shows both real and estimated 1st Edition prices
- **Value Calculations** - Proper collection value computation

### ✅ Backend Features
- **Database Schema** - New fields for 1st Edition pricing data
- **API Integration** - Extracts real pricing from Pokemon TCG API
- **Data Sync** - Includes 1st Edition fields in sync operations
- **Type Safety** - Full TypeScript support

### ✅ Pricing Intelligence
- **Real TCGPlayer Data** - Uses actual USD pricing when available
- **Smart Estimation** - 2-3x multiplier for cards without specific data
- **Currency Support** - Handles USD to EUR conversion
- **Fallback Logic** - Graceful degradation when pricing unavailable

## 🔧 Troubleshooting

### Test Script Issues
If the test script fails:

1. **Environment Variables Missing:**
   ```
   ❌ Missing Supabase environment variables
   ```
   - Ensure `.env.local` exists in project root
   - Check that Supabase URL and key are correct

2. **Database Schema Errors:**
   ```
   ❌ Database schema test failed: column does not exist
   ```
   - Run the database migration first
   - Verify migration completed successfully in Supabase

3. **No WotC Cards Found:**
   ```
   ⚠️ No Base Set cards found in database
   ```
   - Import card data using existing sync scripts
   - Ensure WotC era sets are in your database

### UI Issues
If green buttons don't appear:

1. **Check Set Detection:**
   - Verify card is from WotC era (base1, base2, gym1, neo1, etc.)
   - Check browser console for JavaScript errors

2. **Styling Issues:**
   - Ensure CSS changes are applied
   - Check that `.first-edition-btn` styles are loaded

3. **TypeScript Errors:**
   - Regenerate Supabase types if needed
   - Restart development server

## 📊 Expected Results

After successful setup, you should see:

### In the UI:
- ✅ Green 1st Edition buttons on WotC era cards
- ✅ No 1st Edition buttons on modern cards
- ✅ Pricing display showing 1st Edition values
- ✅ Collection management working correctly

### In the Database:
- ✅ New pricing fields populated during sync
- ✅ 1st Edition variants accepted in user_collections
- ✅ Proper value calculations in collection stats

### Test Results:
```
🎯 Overall: 6/6 tests passed
🎉 All tests passed! 1st Edition pricing integration is ready.
```

## 🚀 Next Steps

Once setup is complete:

1. **Sync Card Data** - Run your existing data sync to populate pricing
2. **User Testing** - Have users test the new 1st Edition features
3. **Monitor Performance** - Check that new database fields don't impact performance
4. **Pricing Updates** - Set up regular sync to keep 1st Edition pricing current

## 📞 Support

If you encounter issues:

1. Check the test script output for specific error messages
2. Verify database migration completed successfully
3. Ensure all TypeScript types are up to date
4. Check browser console for frontend errors

The 1st Edition feature is now fully implemented and ready for production use!