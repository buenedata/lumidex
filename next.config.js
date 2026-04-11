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

    // R2 images are served via plain <img> tags (already WebP-compressed CDN),
    // so no remotePatterns entry is needed for the R2 hostname.
    // The two external card-image domains are kept here for any future
    // next/image usage against pokemontcg.io or scrydex.com source images.
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
    ],
  },
}

module.exports = nextConfig