/** @type {import('next').NextConfig} */

// next.config.js is evaluated after Next.js loads .env.local, so
// NEXT_PUBLIC_SUPABASE_URL is available here at startup time.
// We extract the exact hostname so next/image can serve Supabase Storage images.
let supabaseHostname = '*.supabase.co' // safe fallback
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  } catch {
    // malformed URL — leave the wildcard fallback
  }
}

const nextConfig = {
  experimental: {
    // Reduces webpack memory usage during `next build` by reusing memory
    // allocations between incremental rebuilds instead of allocating fresh
    // objects each time.  Has no effect under Turbopack (next dev --turbo).
    webpackMemoryOptimizations: true,
  },
  images: {
    // Cache optimised images for 1 hour.  Without this, Next.js re-processes
    // every image on the next cold request, keeping sharp buffers in memory.
    minimumCacheTTL: 3600,

    // Constrain the set of generated size variants so the image optimiser
    // does not keep an unbounded number of resized buffers in the heap.
    deviceSizes: [640, 1080, 1920],
    imageSizes: [64, 128, 256],

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.scrydex.com',
        port: '',
        pathname: '/**',
      },
      {
        // Supabase Storage — exact project hostname derived from NEXT_PUBLIC_SUPABASE_URL
        protocol: 'https',
        hostname: supabaseHostname,
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig