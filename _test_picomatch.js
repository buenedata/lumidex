const { makeRe } = require('./node_modules/next/dist/compiled/picomatch');

const imgUrl = new URL('https://ysvskytxewtlxpxeiskf.supabase.co/storage/v1/object/public/set-images/sv1-logo.jpg');

console.log('hostname:', imgUrl.hostname);
console.log('pathname:', imgUrl.pathname);

// Test exact hostname match
const exactMatch = makeRe('ysvskytxewtlxpxeiskf.supabase.co').test(imgUrl.hostname);
console.log('exact hostname match:', exactMatch);

// Test wildcard hostname match
const wildcardMatch = makeRe('*.supabase.co').test(imgUrl.hostname);
console.log('wildcard *.supabase.co match:', wildcardMatch);

// Test pathname with /storage/v1/object/public/**
const pathMatch = makeRe('/storage/v1/object/public/**', { dot: true }).test(imgUrl.pathname);
console.log('pathname /storage/v1/object/public/** match:', pathMatch);

// Test the full matchRemotePattern logic
const { matchRemotePattern } = require('./node_modules/next/dist/shared/lib/match-remote-pattern');

const patterns = [
  { protocol: 'https', hostname: 'ysvskytxewtlxpxeiskf.supabase.co', port: '', pathname: '/storage/v1/object/public/**' },
  { protocol: 'https', hostname: '*.supabase.co', port: '', pathname: '/storage/v1/object/public/**' },
  { protocol: 'https', hostname: 'images.pokemontcg.io', port: '', pathname: '/**' },
];

patterns.forEach((p, i) => {
  try {
    const result = matchRemotePattern(p, imgUrl);
    console.log('pattern', i, '(' + p.hostname + '):', result);
  } catch(e) {
    console.log('pattern', i, 'ERROR:', e.message);
  }
});

// Also test pokemontcg URL
const pokemonUrl = new URL('https://images.pokemontcg.io/sv1/logo.png');
const pokemonMatch = matchRemotePattern({ protocol: 'https', hostname: 'images.pokemontcg.io', port: '', pathname: '/**' }, pokemonUrl);
console.log('pokemontcg URL match:', pokemonMatch);
