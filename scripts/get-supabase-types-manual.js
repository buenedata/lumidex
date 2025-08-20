const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

// Extract project ID from URL
const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectId) {
  console.error('❌ Could not extract project ID from Supabase URL');
  process.exit(1);
}

console.log('🔧 Supabase TypeScript Types Setup');
console.log('=====================================\n');

console.log(`📡 Project ID: ${projectId}`);
console.log(`🌐 Project URL: ${supabaseUrl}\n`);

console.log('📋 OPTION 1: Using npx (Recommended)');
console.log('=====================================');
console.log('Run this command in your terminal:');
console.log(`npx supabase gen types typescript --project-id ${projectId} > src/types/supabase.ts\n`);

console.log('📋 OPTION 2: Manual from Dashboard');
console.log('===================================');
console.log('1. Go to your Supabase dashboard:');
console.log(`   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}`);
console.log('2. Navigate to: Settings → API');
console.log('3. Scroll down to "Generated types"');
console.log('4. Copy the TypeScript types');
console.log('5. Save them to: src/types/supabase.ts\n');

console.log('📋 OPTION 3: Install Supabase CLI');
console.log('==================================');
console.log('Install globally:');
console.log('npm install -g supabase');
console.log('');
console.log('Then run:');
console.log(`supabase gen types typescript --project-id ${projectId} > src/types/supabase.ts\n`);

// Create the types directory if it doesn't exist
const typesDir = path.join(__dirname, '..', 'src', 'types');
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true });
  console.log('✅ Created src/types directory');
}

// Create a placeholder types file with instructions
const placeholderTypes = `// Supabase Generated Types
// Replace this file with generated types from Supabase
// 
// To generate types:
// 1. Run: npx supabase gen types typescript --project-id ${projectId} > src/types/supabase.ts
// 2. Or copy from Supabase Dashboard → Settings → API → Generated types
//
// Project ID: ${projectId}
// Project URL: ${supabaseUrl}

export interface Database {
  public: {
    Tables: {
      user_collections: {
        Row: {
          id: string
          user_id: string
          card_id: string
          variant: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
          quantity: number
          condition: string
          is_foil: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
          quantity?: number
          condition?: string
          is_foil?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          variant?: 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition'
          quantity?: number
          condition?: string
          is_foil?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      // Add other tables as needed...
    }
  }
}
`;

const typesFile = path.join(typesDir, 'supabase.ts');
if (!fs.existsSync(typesFile)) {
  fs.writeFileSync(typesFile, placeholderTypes);
  console.log('✅ Created placeholder types file: src/types/supabase.ts');
  console.log('   (Replace with actual generated types)\n');
}

console.log('🎯 NEXT STEPS:');
console.log('==============');
console.log('1. Generate the types using one of the options above');
console.log('2. The 1st Edition variant should work without type errors');
console.log('3. Restart your development server if needed\n');

console.log('💡 The temporary type assertions are already in place,');
console.log('   so the 1st Edition feature should work even without regenerating types!');