import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Lumidex Theme Colors - Mystisk Lilla + Sort
        'pkmn-dark': '#000000',           // Kullsvart
        'pkmn-card': '#111111',           // Dyp grafitt
        'pkmn-surface': '#111111',        // Dyp grafitt
        'pokemon-gold': '#6B0F1A',        // Crimson-lilla
        'pokemon-gold-hover': '#7D3C98',  // Royal Violet
        'pokemon-gold-dark': '#6B0F1A',   // Crimson-lilla (darker)
        
        // Lumidex Accent Colors
        'lumidex-neon': '#B5A7F0',        // Neonlavendel
        'lumidex-amethyst': '#C39BD3',    // Lys ametyst
        'lumidex-white': '#FFFFFF',       // Hvit
        'lumidex-silver': '#CFCFCF',      // Sølvgrå
        
        // Card Variant Colors - Updated for Lumidex theme
        'variant-normal': '#B5A7F0',      // Neonlavendel
        'variant-holo': '#7D3C98',        // Royal Violet
        'variant-reverse': '#C39BD3',     // Lys ametyst
        'variant-pokeball': '#6B0F1A',    // Crimson-lilla
        'variant-masterball': '#7D3C98',  // Royal Violet
        
        // Pokemon Type Colors
        'type-grass': '#4caf50',
        'type-fire': '#f44336',
        'type-water': '#2196f3',
        'type-lightning': '#ffeb3b',
        'type-psychic': '#9c27b0',
        'type-fighting': '#795548',
        'type-darkness': '#424242',
        'type-metal': '#607d8b',
        'type-fairy': '#e91e63',
        'type-dragon': '#ff5722',
        'type-colorless': '#9e9e9e',
        
        // Legacy colors for compatibility
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        'gaming': ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'card-hover': 'cardHover 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
      },
      keyframes: {
        cardHover: {
          '0%': { transform: 'translateY(0) scale(1)' },
          '100%': { transform: 'translateY(-8px) scale(1.02)' },
        },
        glowPulse: {
          '0%': { boxShadow: '0 0 20px rgba(255, 215, 0, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(255, 215, 0, 0.4)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [],
}
export default config