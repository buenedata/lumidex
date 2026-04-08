'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import type { PriceSource, PortfolioVisibility } from '@/types'

// ── Public type shared with wizard + settings modal ───────────
export interface SettingsValues {
  display_name: string
  bio: string
  location: string
  preferred_language: string
  preferred_currency: string
  price_source: PriceSource
  grey_out_unowned: boolean
  profile_private: boolean
  show_portfolio_value: PortfolioVisibility
  lists_public_by_default: boolean
}

export const defaultSettings: SettingsValues = {
  display_name: '',
  bio: '',
  location: '',
  preferred_language: 'en',
  preferred_currency: 'USD',
  price_source: 'tcgplayer',
  grey_out_unowned: true,
  profile_private: false,
  show_portfolio_value: 'public',
  lists_public_by_default: false,
}

// ── Option lists ──────────────────────────────────────────────
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'nb', label: 'Norwegian (Bokmål)' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'sv', label: 'Swedish' },
  { value: 'da', label: 'Danish' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ko', label: 'Korean' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'NOK', label: 'NOK – Norwegian Krone' },
  { value: 'SEK', label: 'SEK – Swedish Krona' },
  { value: 'DKK', label: 'DKK – Danish Krone' },
  { value: 'CAD', label: 'CAD – Canadian Dollar' },
  { value: 'AUD', label: 'AUD – Australian Dollar' },
  { value: 'JPY', label: 'JPY – Japanese Yen' },
  { value: 'CHF', label: 'CHF – Swiss Franc' },
]

const BIO_MAX = 280

// ── Sub-components ────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-secondary mb-1.5">{children}</label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  id,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  id: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full h-9 bg-surface border border-subtle rounded-lg px-3 text-sm text-primary',
          'transition-colors duration-150 appearance-none cursor-pointer',
          'hover:border-[rgba(255,255,255,0.15)]',
          'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
        )}
        style={{ backgroundImage: 'none' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-[#111118]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 cursor-pointer group"
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <div
          className={cn(
            'w-10 h-5 rounded-full border transition-all duration-200',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40',
            checked
              ? 'bg-accent border-accent'
              : 'bg-surface border-subtle group-hover:border-[rgba(255,255,255,0.15)]'
          )}
        />
        <div
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </div>
      <div>
        <p className="text-sm text-primary leading-tight">{label}</p>
        {description && (
          <p className="text-xs text-muted mt-0.5 leading-snug">{description}</p>
        )}
      </div>
    </label>
  )
}

function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; description?: string }[]
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-2">
        {options.map(opt => (
          <label
            key={opt.value}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150',
              value === opt.value
                ? 'border-accent bg-accent/10'
                : 'border-subtle bg-surface hover:border-[rgba(255,255,255,0.15)]'
            )}
          >
            <div
              className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150',
                value === opt.value ? 'border-accent' : 'border-muted'
              )}
            >
              {value === opt.value && (
                <div className="w-2 h-2 rounded-full bg-accent" />
              )}
            </div>
            <input
              type="radio"
              className="sr-only"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <div>
              <p className="text-sm text-primary leading-tight">{opt.label}</p>
              {opt.description && (
                <p className="text-xs text-muted mt-0.5">{opt.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Main SettingsForm ─────────────────────────────────────────

interface SettingsFormProps {
  values: SettingsValues
  onChange: (patch: Partial<SettingsValues>) => void
  /** Which field groups to show — defaults to all */
  sections?: Array<'identity' | 'locale' | 'display' | 'privacy'>
}

export default function SettingsForm({
  values,
  onChange,
  sections = ['identity', 'locale', 'display', 'privacy'],
}: SettingsFormProps) {
  const show = (s: string) => sections.includes(s as never)

  return (
    <div className="flex flex-col gap-6">

      {/* ── Identity ─────────────────────────────────────────── */}
      {show('identity') && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Identity
          </h3>

          <Input
            id="display_name"
            label="Display Name"
            placeholder="How you appear to others"
            value={values.display_name}
            onChange={e => onChange({ display_name: e.target.value })}
            maxLength={50}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className="text-xs font-medium text-secondary">
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              placeholder="Tell the community a little about yourself…"
              value={values.bio}
              maxLength={BIO_MAX}
              onChange={e => onChange({ bio: e.target.value })}
              className={cn(
                'w-full bg-surface border border-subtle rounded-lg px-3 py-2 text-sm text-primary resize-none',
                'placeholder:text-muted',
                'transition-colors duration-150',
                'hover:border-[rgba(255,255,255,0.15)]',
                'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30'
              )}
            />
            <p className="text-xs text-muted text-right">
              {values.bio.length}/{BIO_MAX}
            </p>
          </div>

          <Input
            id="location"
            label="Location"
            placeholder="e.g. Oslo, Norway"
            value={values.location}
            onChange={e => onChange({ location: e.target.value })}
            maxLength={80}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
        </section>
      )}

      {/* ── Locale ───────────────────────────────────────────── */}
      {show('locale') && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Locale
          </h3>
          <SelectField
            id="preferred_language"
            label="Preferred Language"
            value={values.preferred_language}
            onChange={v => onChange({ preferred_language: v })}
            options={LANGUAGES}
          />
          <SelectField
            id="preferred_currency"
            label="Preferred Currency"
            value={values.preferred_currency}
            onChange={v => onChange({ preferred_currency: v })}
            options={CURRENCIES}
          />
        </section>
      )}

      {/* ── Display ──────────────────────────────────────────── */}
      {show('display') && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Collection Display
          </h3>

          <SegmentedControl<PriceSource>
            label="Price Source"
            value={values.price_source}
            onChange={v => onChange({ price_source: v })}
            options={[
              {
                value: 'tcgplayer',
                label: 'TCGPlayer',
                description: 'US market prices from TCGPlayer',
              },
              {
                value: 'cardmarket',
                label: 'Cardmarket',
                description: 'European market prices from Cardmarket',
              },
            ]}
          />

          <Toggle
            id="grey_out_unowned"
            label="Grey out unowned cards"
            description="Cards you don't own will appear dimmed in set views"
            checked={values.grey_out_unowned}
            onChange={v => onChange({ grey_out_unowned: v })}
          />
        </section>
      )}

      {/* ── Privacy ──────────────────────────────────────────── */}
      {show('privacy') && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Privacy
          </h3>

          <Toggle
            id="profile_private"
            label="Private profile"
            description="Your bio, location, sets and achievements will be hidden from other users"
            checked={values.profile_private}
            onChange={v => onChange({ profile_private: v })}
          />

          <SegmentedControl<PortfolioVisibility>
            label="Portfolio Value Visibility"
            value={values.show_portfolio_value}
            onChange={v => onChange({ show_portfolio_value: v })}
            options={[
              {
                value: 'public',
                label: 'Public',
                description: 'Anyone can see your portfolio value',
              },
              {
                value: 'friends_only',
                label: 'Friends only',
                description: 'Only mutual connections can see your portfolio value',
              },
              {
                value: 'private',
                label: 'Private',
                description: 'Only you can see your portfolio value',
              },
            ]}
          />

          <Toggle
            id="lists_public_by_default"
            label="New lists are public by default"
            description="When you create a new custom list it will be publicly visible unless you change it"
            checked={values.lists_public_by_default}
            onChange={v => onChange({ lists_public_by_default: v })}
          />
        </section>
      )}
    </div>
  )
}
