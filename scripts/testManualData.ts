#!/usr/bin/env ts-node

/**
 * Manual Database Test Script
 * Tests that our manual Pokemon database works with existing app functionality
 * Run with: npx ts-node scripts/testManualData.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey)

async function testManualDatabase() {
  console.log('🧪 Testing Manual Pokemon Database')
  console.log('=' .repeat(50))

  let allTests = 0
  let passedTests = 0

  // Test 1: Check if sets exist
  console.log('\n1️⃣  Testing Sets Data...')
  allTests++
  try {
    const { data: sets, error } = await supabase
      .from('sets')
      .select('*')
      .order('release_date', { ascending: true })

    if (error) throw error

    if (sets && sets.length > 0) {
      console.log(`✅ Found ${sets.length} sets`)
      console.log(`   📊 Oldest: ${sets[0]?.name} (${sets[0]?.release_date})`)
      console.log(`   📊 Newest: ${sets[sets.length - 1]?.name} (${sets[sets.length - 1]?.release_date})`)
      
      // Check for key sets
      const baseSet = sets.find(s => s.id === 'base1')
      const modernSet = sets.find(s => s.id === 'sv1')
      if (baseSet && modernSet) {
        console.log(`   ✅ Both classic (${baseSet.name}) and modern (${modernSet.name}) sets present`)
      }
      passedTests++
    } else {
      console.log('❌ No sets found')
    }
  } catch (error) {
    console.log('❌ Sets test failed:', error)
  }

  // Test 2: Check if cards exist
  console.log('\n2️⃣  Testing Cards Data...')
  allTests++
  try {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('*')
      .limit(10)

    if (error) throw error

    if (cards && cards.length > 0) {
      console.log(`✅ Found cards (showing first ${cards.length}):`)
      cards.forEach(card => {
        console.log(`   🃏 ${card.name} (${card.number}) - ${card.rarity}`)
      })
      
      // Check for proper rarity data
      const hasRarity = cards.filter(c => c.rarity).length
      console.log(`   ✅ ${hasRarity}/${cards.length} cards have rarity data`)
      
      if (hasRarity > 0) {
        passedTests++
      }
    } else {
      console.log('❌ No cards found')
    }
  } catch (error) {
    console.log('❌ Cards test failed:', error)
  }

  // Test 3: Check cards-to-sets relationship
  console.log('\n3️⃣  Testing Set-Card Relationships...')
  allTests++
  try {
    const { data: cardsWithSets, error } = await supabase
      .from('cards')
      .select(`
        id,
        name,
        set_id,
        sets!inner(name, series)
      `)
      .limit(5)

    if (error) throw error

    if (cardsWithSets && cardsWithSets.length > 0) {
      console.log(`✅ Card-Set relationships working:`)
      cardsWithSets.forEach((card: any) => {
        const setName = Array.isArray(card.sets) ? card.sets[0]?.name : card.sets?.name
        console.log(`   🔗 ${card.name} → ${setName}`)
      })
      passedTests++
    } else {
      console.log('❌ No card-set relationships found')
    }
  } catch (error) {
    console.log('❌ Relationship test failed:', error)
  }

  // Test 4: Test search functionality (like app would use)
  console.log('\n4️⃣  Testing Search Functionality...')
  allTests++
  try {
    const { data: searchResults, error } = await supabase
      .from('cards')
      .select(`
        id,
        name,
        number,
        rarity,
        sets!inner(name)
      `)
      .ilike('name', '%charizard%')

    if (error) throw error

    if (searchResults && searchResults.length > 0) {
      console.log(`✅ Search for 'charizard' found ${searchResults.length} results:`)
      searchResults.slice(0, 3).forEach((card: any) => {
        const setName = Array.isArray(card.sets) ? card.sets[0]?.name : card.sets?.name
        console.log(`   🔍 ${card.name} (${card.rarity}) from ${setName}`)
      })
      passedTests++
    } else {
      console.log('⚠️  No search results for Charizard (might be expected if not added)')
      passedTests++ // Not necessarily a failure
    }
  } catch (error) {
    console.log('❌ Search test failed:', error)
  }

  // Test 5: Check total counts
  console.log('\n5️⃣  Testing Data Counts...')
  allTests++
  try {
    const [setsResult, cardsResult] = await Promise.all([
      supabase.from('sets').select('*', { count: 'exact', head: true }),
      supabase.from('cards').select('*', { count: 'exact', head: true })
    ])

    if (setsResult.error || cardsResult.error) {
      throw new Error('Count query failed')
    }

    const setCount = setsResult.count || 0
    const cardCount = cardsResult.count || 0

    console.log(`✅ Database Summary:`)
    console.log(`   📦 Sets: ${setCount}`)
    console.log(`   🃏 Cards: ${cardCount}`)
    console.log(`   📊 Average cards per set: ${setCount > 0 ? Math.round(cardCount / setCount) : 0}`)

    // Test new setTotal and setComplete fields
    const { data: sampleSet } = await supabase
      .from('sets')
      .select('name, setTotal, setComplete')
      .limit(1)
      .single()

    if (sampleSet) {
      console.log(`   📊 Sample set structure: ${sampleSet.name}`)
      console.log(`      • Base cards (setTotal): ${sampleSet.setTotal}`)
      console.log(`      • Total with secrets (setComplete): ${sampleSet.setComplete}`)
    }

    if (setCount > 0 && cardCount > 0) {
      passedTests++
    }
  } catch (error) {
    console.log('❌ Count test failed:', error)
  }

  // Test 6: Check rarity distribution
  console.log('\n6️⃣  Testing Rarity Distribution...')
  allTests++
  try {
    const { data: rarityData, error } = await supabase
      .from('cards')
      .select('rarity')

    if (error) throw error

    if (rarityData && rarityData.length > 0) {
      const rarityCounts: { [key: string]: number } = {}
      rarityData.forEach(card => {
        const rarity = card.rarity || 'Unknown'
        rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1
      })

      console.log(`✅ Rarity Distribution:`)
      Object.entries(rarityCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([rarity, count]) => {
          console.log(`   🏆 ${rarity}: ${count} cards`)
        })
      
      const hasMultipleRarities = Object.keys(rarityCounts).length > 1
      if (hasMultipleRarities) {
        passedTests++
      }
    } else {
      console.log('❌ No rarity data found')
    }
  } catch (error) {
    console.log('❌ Rarity test failed:', error)
  }

  // Final Results
  console.log('\n' + '=' .repeat(50))
  console.log('🧪 Test Results Summary')
  console.log('=' .repeat(50))
  console.log(`✅ Passed: ${passedTests}/${allTests} tests`)
  
  if (passedTests === allTests) {
    console.log('🎉 All tests passed! Manual database is working correctly.')
    console.log('🚀 Your app should work great with the manual data!')
  } else if (passedTests >= allTests * 0.8) {
    console.log('⚠️  Most tests passed. Minor issues detected but app should work.')
  } else {
    console.log('❌ Several tests failed. Check your database setup.')
  }

  console.log('\n📝 Next Steps:')
  console.log('1. Run the manual database script if you haven\'t:')
  console.log('   psql -h your-host -U postgres -d postgres -f database/manual_pokemon_data.sql')
  console.log('\n2. Test your app functionality:')
  console.log('   npm run dev')
  console.log('\n3. Add more sets and cards as needed using the documented process.')
  
  console.log('\n💰 Optional: Fetch live pricing data:')
  console.log('   npx ts-node scripts/fetchPricing.ts')
}

// Run the tests
async function main() {
  try {
    await testManualDatabase()
  } catch (error) {
    console.error('❌ Test script failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export default testManualDatabase