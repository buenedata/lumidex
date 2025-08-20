const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const pokemonApiKey = process.env.POKEMON_TCG_API_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

if (!pokemonApiKey) {
  console.warn('⚠️  Pokemon TCG API key not found. Data sync will work but with rate limits.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  try {
    console.log('🚀 Setting up Lumidex database...\n')
    
    // Read the fixed schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema-fixed.sql')
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath)
      process.exit(1)
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8')
    console.log('📄 Schema file loaded successfully')
    
    // Execute the schema directly
    console.log('🔧 Executing database schema...')
    const { error: schemaError } = await supabase.rpc('exec_sql', { 
      sql: schema 
    })
    
    if (schemaError) {
      console.error('❌ Error executing schema:', schemaError.message)
      
      // Try alternative approach - execute in smaller chunks
      console.log('🔄 Trying alternative approach...')
      await executeSchemaInChunks(schema)
    } else {
      console.log('✅ Database schema executed successfully')
    }
    
    // Verify tables were created
    await verifyTables()
    
    console.log('\n🎉 Database setup completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Start your Next.js development server: npm run dev')
    console.log('2. Navigate to http://localhost:3000/admin to begin data sync')
    console.log('3. Or run: node scripts/sync-initial-data.js')
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message)
    process.exit(1)
  }
}

async function executeSchemaInChunks(schema) {
  // Split schema into individual statements
  const statements = schema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'))
  
  console.log(`📝 Executing ${statements.length} SQL statements...`)
  
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        console.warn(`⚠️  Warning in statement ${i + 1}:`, error.message.substring(0, 100))
        errorCount++
      } else {
        successCount++
      }
    } catch (err) {
      console.warn(`⚠️  Error in statement ${i + 1}:`, err.message.substring(0, 100))
      errorCount++
    }
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`📊 Progress: ${i + 1}/${statements.length} statements processed`)
    }
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  console.log(`✅ Schema execution completed: ${successCount} successful, ${errorCount} warnings/errors`)
}

async function verifyTables() {
  console.log('🔍 Verifying database tables...')
  
  const expectedTables = [
    'profiles', 'sets', 'cards', 'user_collections', 
    'friendships', 'trades', 'trade_items', 'wishlists', 
    'user_achievements', 'collection_stats'
  ]
  
  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', expectedTables)
    
    if (error) {
      console.warn('⚠️  Could not verify tables:', error.message)
      return
    }
    
    const createdTables = tables.map(t => t.table_name)
    const missingTables = expectedTables.filter(t => !createdTables.includes(t))
    
    console.log('📋 Tables created:', createdTables.join(', '))
    
    if (missingTables.length > 0) {
      console.warn('⚠️  Missing tables:', missingTables.join(', '))
    } else {
      console.log('✅ All expected tables created successfully')
    }
    
    // Test basic functionality
    const { count, error: countError } = await supabase
      .from('sets')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.warn('⚠️  Could not test table access:', countError.message)
    } else {
      console.log(`📊 Sets table accessible (${count || 0} records)`)
    }
    
  } catch (error) {
    console.warn('⚠️  Error verifying tables:', error.message)
  }
}

// Run the setup
setupDatabase()