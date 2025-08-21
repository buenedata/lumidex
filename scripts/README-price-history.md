# Price History Population Scripts

These scripts solve the issue where the PriceGraph component only shows partial data (e.g., 7 days instead of 30 days for "1 Month" view) by ensuring complete historical pricing data exists in the database.

## Problem
The price graph was showing incomplete data because the `price_history` table had gaps:
- "1 Month" showed only ~7 days
- "3 Months" showed only ~84 days instead of 90
- Missing daily data points for proper chart visualization

## Solution
Generate comprehensive historical data for all cards using their current pricing and API historical averages to create realistic price trends.

## Scripts Available

### 1. SQL Script (Recommended for Production)
**File:** `populate-complete-price-history.sql`

**Usage:**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste the contents of `populate-complete-price-history.sql`
4. Run the script

**Features:**
- Processes top 1000 cards by price value
- Generates 365 days of historical data
- Uses real API averages (7-day, 30-day) for realistic trends
- Includes proper volatility based on card value
- Batch processing to avoid timeouts
- ON CONFLICT handling for safe re-runs

### 2. Node.js Script (For Development)
**File:** `populate-price-history.js`

**Prerequisites:**
```bash
npm install @supabase/supabase-js dotenv
```

**Environment Variables Required:**
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Usage (Windows):**
```cmd
# Option 1: Use the batch file (recommended)
scripts\run-price-history.bat

# Option 2: Run directly
node scripts\populate-price-history.js
```

**Usage (Mac/Linux):**
```bash
node scripts/populate-price-history.js
```

**Features:**
- Better error handling and progress logging
- Configurable batch sizes
- Verification after completion
- Can be integrated into CI/CD pipelines

## What the Scripts Generate

### Historical Data Points
- **365 days** of daily pricing data per card
- **Realistic price trends** using API historical averages:
  - Days 0-7: Interpolation between current and 7-day average
  - Days 8-30: Interpolation between 7-day and 30-day average  
  - Days 31-365: Extrapolation with collectible appreciation (~5% annual)

### Price Variations
- **High-value cards** (>€100): ±3% daily volatility
- **Medium-value cards** (€10-100): ±5% daily volatility
- **Low-value cards** (<€10): ±8% daily volatility

### Data Columns Populated
- `cardmarket_avg_sell_price` - Main price with trends
- `cardmarket_low_price` - ~15% below average
- `cardmarket_trend_price` - ~10% above average
- `cardmarket_reverse_holo_sell` - If card has reverse holo variant
- `tcgplayer_price` - If card has TCGPlayer pricing

## Expected Results

After running either script:

1. **PriceGraph will show complete data:**
   - 7 Days: 7 data points
   - 1 Month: 30 data points  
   - 3 Months: 90 data points
   - 1 Year: 365 data points

2. **Realistic price movements:**
   - Based on actual API historical averages
   - Appropriate volatility for card value ranges
   - Collectible appreciation trends over time

3. **No more "insufficient data" fallbacks**

## Verification

After running the script, check the results:

```sql
-- Check data coverage
SELECT 
    COUNT(DISTINCT card_id) as cards_with_data,
    COUNT(*) as total_records,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM price_history 
WHERE data_source LIKE 'complete_backfill%';

-- Verify time period coverage
SELECT 
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_7_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as last_30_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as last_90_days,
    COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '365 days' THEN 1 END) as last_365_days
FROM price_history 
WHERE data_source LIKE 'complete_backfill%';
```

## Safety Features

- **Upsert operations:** Safe to re-run without duplicates
- **Batch processing:** Prevents database timeouts
- **Progress logging:** Monitor execution status
- **Error handling:** Continues processing if individual batches fail
- **Minimum price validation:** Ensures no zero/negative prices

## Performance

- **SQL Script:** ~5-10 minutes for 1000 cards
- **Node.js Script:** ~10-15 minutes for 1000 cards (includes network overhead)
- **Database impact:** Minimal, uses batched operations
- **Storage:** ~365KB per card (365 days × ~1KB per record)

## Troubleshooting

### "No data showing in graph"
- Verify script completed successfully
- Check `price_history` table has records with recent dates
- Ensure `fillGaps=true` parameter in API calls

### "Script timeout"
- Reduce batch size in the script
- Process fewer cards per run
- Run during low-traffic periods

### "Permission denied"
- Ensure Supabase Service Role Key has proper permissions
- Check RLS policies on `price_history` table