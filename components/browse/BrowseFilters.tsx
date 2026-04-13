'use client'

import { cn } from '@/lib/utils'
import type { ActiveFilters } from './types'

// ── Static option lists ───────────────────────────────────────────────────────

const SUPERTYPES = ['Pokémon', 'Trainer', 'Energy'] as const

const TYPES = [
  'Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting',
  'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water',
] as const

const RARITIES = [
  'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Double Rare',
  'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare',
  'ACE SPEC Rare', 'Ultra Rare', 'Amazing Rare', 'Radiant Rare', 'Promo',
] as const

const TYPE_ACTIVE_STYLE: Record<string, string> = {
  Fire:      'bg-orange-500/15 text-orange-300 border-orange-500/40',
  Water:     'bg-blue-500/15   text-blue-300   border-blue-500/40',
  Grass:     'bg-green-500/15  text-green-300  border-green-500/40',
  Lightning: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
  Psychic:   'bg-pink-500/15   text-pink-300   border-pink-500/40',
  Fighting:  'bg-orange-700/15 text-orange-400 border-orange-700/40',
  Darkness:  'bg-gray-600/20   text-gray-300   border-gray-500/40',
  Metal:     'bg-slate-500/15  text-slate-300  border-slate-500/40',
  Dragon:    'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
  Fairy:     'bg-pink-400/15   text-pink-200   border-pink-400/40',
  Colorless: 'bg-gray-400/15   text-gray-300   border-gray-400/40',
}

// ── Component ────────────────────────────────────────────────────────────────

interface BrowseFiltersProps {
  filters:  ActiveFilters
  onChange: (key: keyof ActiveFilters, value: string) => void
}

export default function BrowseFilters({ filters, onChange }: BrowseFiltersProps) {
  const hasAny = !!(filters.type || filters.rarity || filters.supertype)
  const typeActive   = TYPE_ACTIVE_STYLE[filters.type]   ?? 'bg-accent/15 text-accent border-accent/50'
  const rarityActive = 'bg-accent/15 text-accent border-accent/50'

  return (
    <div className="border-b border-subtle" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex flex-wrap items-center gap-2">

        {/* ── Supertype toggles ─────────────────────────────────────── */}
        {SUPERTYPES.map(st => {
          const active = filters.supertype === st
          const icon = st === 'Pokémon' ? '🔴' : st === 'Trainer' ? '🟡' : '⚡'
          return (
            <button
              key={st}
              onClick={() => onChange('supertype', active ? '' : st)}
              className={cn(
                'pill px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                active
                  ? 'bg-accent/15 text-accent border-accent/50'
                  : 'bg-elevated text-secondary border-subtle hover:border-accent/30 hover:text-primary',
              )}
            >
              {icon} {st}
            </button>
          )
        })}

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* ── Type select ───────────────────────────────────────────── */}
        <div className="relative">
          <select
            value={filters.type}
            onChange={e => onChange('type', e.target.value)}
            className={cn(
              'pill appearance-none h-7 pl-3 pr-7 rounded-full text-xs font-medium border cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-accent/30',
              filters.type
                ? typeActive
                : 'bg-elevated text-secondary border-subtle hover:border-accent/30',
            )}
          >
            <option value="">Type</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <svg
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* ── Rarity select ─────────────────────────────────────────── */}
        <div className="relative">
          <select
            value={filters.rarity}
            onChange={e => onChange('rarity', e.target.value)}
            className={cn(
              'pill appearance-none h-7 pl-3 pr-7 rounded-full text-xs font-medium border cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-accent/30',
              filters.rarity
                ? rarityActive
                : 'bg-elevated text-secondary border-subtle hover:border-accent/30',
            )}
          >
            <option value="">Rarity</option>
            {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <svg
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* ── Clear all ─────────────────────────────────────────────── */}
        {hasAny && (
          <button
            onClick={() => {
              onChange('type', '')
              onChange('rarity', '')
              onChange('supertype', '')
            }}
            className="ml-auto text-xs text-muted hover:text-danger transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
