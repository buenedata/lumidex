'use client'

import Link from 'next/link'
import { useLocale } from '@/contexts/LocaleContext'

interface Feature {
  titleKey: 'feature_trade_hub_title' | 'feature_marketplace_title'
  taglineKey: 'feature_trade_hub_tagline' | 'feature_marketplace_tagline'
  descKey: 'feature_trade_hub_desc' | 'feature_marketplace_desc'
  emoji: string
  href: string
  badgeColour: string
  borderColour: string
  bgTint: string
  glowColour: string
}

const FEATURES: Feature[] = [
  {
    titleKey:   'feature_trade_hub_title',
    taglineKey: 'feature_trade_hub_tagline',
    descKey:    'feature_trade_hub_desc',
    emoji:       '🔄',
    href:        '/trade',
    badgeColour: 'text-amber-400',
    borderColour:'border-amber-400/30',
    bgTint:      'bg-amber-400/[0.04]',
    glowColour:  'rgba(251,191,36,0.18)',
  },
  {
    titleKey:   'feature_marketplace_title',
    taglineKey: 'feature_marketplace_tagline',
    descKey:    'feature_marketplace_desc',
    emoji:       '🏪',
    href:        '/marketplace',
    badgeColour: 'text-price',
    borderColour:'border-price/30',
    bgTint:      'bg-price/[0.04]',
    glowColour:  'rgba(52,211,153,0.18)',
  },
]

export default function ComingSoonFeatures() {
  const { t } = useLocale()

  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <h2
          className="text-lg font-semibold text-primary"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {t('coming_soon_heading')}
        </h2>
        <span className="pill text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium border border-accent/30">
          {t('coming_soon_badge')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map(feature => (
          <Link
            key={feature.href}
            href={feature.href}
            className={`
              group relative flex flex-col overflow-hidden rounded-2xl border ${feature.borderColour} ${feature.bgTint}
              hover:border-opacity-70 hover:shadow-xl
              transition-all duration-200 cursor-pointer
            `}
            style={{ boxShadow: 'none' }}
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
                aria-label={t(feature.titleKey)}
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
                  {t(feature.titleKey)}
                </h3>
                <p className="text-xs font-medium text-secondary mt-0.5">{t(feature.taglineKey)}</p>
              </div>

              <p className="text-xs text-muted leading-relaxed flex-1">
                {t(feature.descKey)}
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
                  {t('coming_soon_label')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
