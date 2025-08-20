const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

async function regenerateTypes() {
  try {
    console.log('🔄 Regenerating Supabase TypeScript types...');
    
    // Check if supabase CLI is installed
    try {
      execSync('supabase --version', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Supabase CLI is not installed');
      console.error('Install it with: npm install -g supabase');
      console.error('Or use npx: npx supabase gen types typescript --project-id YOUR_PROJECT_ID');
      process.exit(1);
    }

    // Extract project ID from URL
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectId) {
      console.error('❌ Could not extract project ID from Supabase URL');
      process.exit(1);
    }

    console.log(`📡 Project ID: ${projectId}`);
    
    // Generate types
    const typesDir = path.join(__dirname, '..', 'src', 'types');
    const typesFile = path.join(typesDir, 'supabase.ts');
    
    // Ensure types directory exists
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }

    console.log('🔧 Generating TypeScript types...');
    
    const command = `supabase gen types typescript --project-id ${projectId}`;
    const types = execSync(command, { encoding: 'utf8' });
    
    // Write types to file
    fs.writeFileSync(typesFile, types);
    
    console.log('✅ Successfully generated Supabase types!');
    console.log(`📁 Types saved to: ${typesFile}`);
    
    // Update the main supabase client to use the new types
    const supabaseClientPath = path.join(__dirname, '..', 'src', 'lib', 'supabase.ts');
    
    if (fs.existsSync(supabaseClientPath)) {
      let clientContent = fs.readFileSync(supabaseClientPath, 'utf8');
      
      // Check if types import already exists
      if (!clientContent.includes('import { Database }')) {
        // Add types import
        const importLine = "import { Database } from '@/types/supabase'\n";
        clientContent = importLine + clientContent;
        
        // Update createClient call to use types
        clientContent = clientContent.replace(
          'createClient(',
          'createClient<Database>('
        );
        
        fs.writeFileSync(supabaseClientPath, clientContent);
        console.log('✅ Updated Supabase client to use generated types');
      }
    }
    
    console.log('\n🎉 Type regeneration complete!');
    console.log('The 1st Edition variant should now work properly.');
    console.log('You may need to restart your development server for changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error regenerating types:', error.message);
    
    if (error.message.includes('project-id')) {
      console.error('\n💡 Alternative approach:');
      console.error('1. Go to your Supabase dashboard');
      console.error('2. Navigate to Settings > API');
      console.error('3. Copy the TypeScript types');
      console.error('4. Save them to src/types/supabase.ts');
    }
    
    process.exit(1);
  }
}

regenerateTypes();