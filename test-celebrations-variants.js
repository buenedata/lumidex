// Test script to verify Celebrations variant logic
const { getAvailableVariants } = require('./src/components/pokemon/CollectionButtons.tsx');

// Mock Celebrations Groudon card data
const celebrationsGroudon = {
  id: 'swsh12pt5-4',
  name: 'Groudon',
  number: '4',
  set_id: 'swsh12pt5',
  rarity: 'Rare Holo',
  types: ['Fighting'],
  sets: {
    name: 'Celebrations',
    id: 'swsh12pt5'
  }
};

// Mock regular set Groudon for comparison
const regularGroudon = {
  id: 'ex7-1',
  name: 'Groudon ex',
  number: '1',
  set_id: 'ex7',
  rarity: 'Rare Holo EX',
  types: ['Fighting'],
  sets: {
    name: 'Team Rocket Returns',
    id: 'ex7'
  }
};

console.log('Testing Celebrations variant logic...\n');

console.log('Celebrations Groudon variants:');
try {
  const celebrationsVariants = getAvailableVariants(celebrationsGroudon);
  console.log('Available variants:', celebrationsVariants);
  
  if (celebrationsVariants.includes('reverse_holo')) {
    console.log('❌ ERROR: Celebrations Groudon should NOT have reverse_holo variant');
  } else {
    console.log('✅ SUCCESS: Celebrations Groudon correctly excludes reverse_holo');
  }
  
  if (celebrationsVariants.includes('holo')) {
    console.log('✅ SUCCESS: Celebrations Groudon correctly includes holo variant');
  } else {
    console.log('❌ ERROR: Celebrations Groudon should have holo variant');
  }
} catch (error) {
  console.log('❌ ERROR testing Celebrations variants:', error.message);
}

console.log('\nRegular set Groudon variants (for comparison):');
try {
  const regularVariants = getAvailableVariants(regularGroudon);
  console.log('Available variants:', regularVariants);
  
  if (regularVariants.includes('holo')) {
    console.log('✅ SUCCESS: Regular Groudon correctly includes holo variant');
  } else {
    console.log('❌ ERROR: Regular Groudon should have holo variant');
  }
} catch (error) {
  console.log('❌ ERROR testing regular variants:', error.message);
}

console.log('\nTest completed.');