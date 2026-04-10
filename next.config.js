/** @type {import('next').NextConfig} */

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
        // Cloudflare R2 public bucket — all images are served from here
        protocol: 'https',
        hostname: 'pub-5781f5d7c220456fb6732e5213993cc7.r2.dev',
        pathname: '/**',
      },
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
    ],
  },
}

module.exports = nextConfig