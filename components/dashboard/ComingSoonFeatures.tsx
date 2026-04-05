'use client'

import Link from 'next/link'

interface Feature {
  title: string
  tagline: string
  description: string
  emoji: string
  href: string
  badgeColour: string   // Tailwind text class for badge text
  borderColour: string  // Tailwind border class
  bgTint: string        // Tailwind bg class for card tint
  glowColour: string    // inline style colour for radial glow
}

const FEATURES: Feature[] = [
  {
    title:       'Trade Hub',
    tagline:     'Trade cards with friends',
    description:
      'List your duplicates, browse what friends have, and arrange trades directly on Lumidex — no middlemen, no fees.',
    emoji:       '🔄',
    href:        '/trade',
    badgeColour: 'text-amber-400',
    borderColour:'border-amber-400/30',
    bgTint:      'bg-amber-400/[0.04]',
    glowColour:  'rgba(251,191,36,0.18)',
  },
  {
    title:       'Marketplace',
    tagline:     'Buy & sell with ease',
    description:
      'A dedicated card marketplace to buy, sell and price-check any Pokémon card in your preferred local currency.',
    emoji:       '🏪',
    href:        '/marketplace',
    badgeColour: 'text-price',
    borderColour:'border-price/30',
    bgTint:      'bg-price/[0.04]',
    glowColour:  'rgba(52,211,153,0.18)',
  },
]

interface FeatureCardProps {
  feature: Feature
}

function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <Link
      href={feature.href}
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl border ${feature.borderColour} ${feature.bgTint}
        hover:border-opacity-70 hover:shadow-xl
        transition-all duration-200 cursor-pointer
      `}
      style={{
        boxShadow: 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `0 0 32px ${feature.glowColour}`
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      {/* Radial glow in corner */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse at 90% 10%, ${feature.glowColour} 0%, transparent 60%)`,
        }}
      />

      {/* Icon area */}
      <div className="flex items-center justify-center h-24 text-5xl">
        <span
          role="img"
          aria-label={feature.title}
          className="group-hover:scale-110 transition-transform duration-200 inline-block"
        >
          {feature.emoji}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 px-5 pb-5 gap-2">
        <div>
          <h3
            className="text-base font-bold text-primary"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {feature.title}
          </h3>
          <p className="text-xs font-medium text-secondary mt-0.5">{feature.tagline}</p>
        </div>

        <p className="text-xs text-muted leading-relaxed flex-1">
          {feature.description}
        </p>

        {/* Coming Soon badge */}
        <div className="pt-2">
          <span
            className={`
              inline-flex items-center gap-1.5 text-xs font-semibold
              px-2.5 py-1 rounded-full border ${feature.borderColour} ${feature.badgeColour}
            `}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Coming Soon
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ComingSoonFeatures() {
  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <h2
          className="text-lg font-semibold text-primary"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          What&apos;s Coming to Lumidex
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium border border-accent/30">
          Roadmap
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map(feature => (
          <FeatureCard key={feature.href} feature={feature} />
        ))}
      </div>
    </div>
  )
}
