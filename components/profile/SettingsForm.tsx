'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'

// ── Public type shared with wizard + settings modal ───────────
export interface SettingsValues {
  display_name: string
  bio: string
  location: string
  preferred_language: string
  preferred_currency: string
  grey_out_unowned: boolean
  profile_private: boolean
  lists_public_by_default: boolean
  /** Social / marketplace profile links */
  social_cardmarket: string
  social_instagram: string
  social_facebook: string
}

export const defaultSettings: SettingsValues = {
  display_name: '',
  bio: '',
  location: '',
  preferred_language: 'en',
  preferred_currency: 'USD',
  grey_out_unowned: true,
  profile_private: false,
  lists_public_by_default: false,
  social_cardmarket: '',
  social_instagram: '',
  social_facebook: '',
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
  sections?: Array<'identity' | 'locale' | 'display' | 'privacy' | 'social'>
}

export default function SettingsForm({
  values,
  onChange,
  sections = ['identity', 'locale', 'display', 'privacy', 'social'],
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

          {/* Pricing preferences — coming soon */}
          <div className="opacity-50 cursor-not-allowed">
            <label className="block text-sm font-medium text-gray-400">Price Source</label>
            <p className="text-xs text-gray-500 mt-1">Price source preferences are coming soon with the new pricing system.</p>
          </div>

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

          {/* Portfolio value visibility — coming soon */}
          <div className="opacity-50 cursor-not-allowed">
            <label className="block text-sm font-medium text-gray-400">Portfolio Value Visibility</label>
            <p className="text-xs text-gray-500 mt-1">Price source preferences are coming soon with the new pricing system.</p>
          </div>

          <Toggle
            id="lists_public_by_default"
            label="New lists are public by default"
            description="When you create a new custom list it will be publicly visible unless you change it"
            checked={values.lists_public_by_default}
            onChange={v => onChange({ lists_public_by_default: v })}
          />
        </section>
      )}

      {/* ── Social & Marketplace Links ────────────────────────── */}
      {show('social') && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Social &amp; Marketplace Links
          </h3>
          <p className="text-xs text-muted -mt-2 leading-snug">
            These will appear as icons on your public profile.
          </p>

          {/* Cardmarket */}
          <Input
            id="social_cardmarket"
            label="Cardmarket Profile URL"
            placeholder="https://www.cardmarket.com/en/Pokemon/Users/YourUsername"
            value={values.social_cardmarket}
            onChange={e => onChange({ social_cardmarket: e.target.value })}
            icon={
              /* Shopping-cart icon standing in for Cardmarket */
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />

          {/* Instagram */}
          <Input
            id="social_instagram"
            label="Instagram"
            placeholder="https://instagram.com/yourhandle  or  @yourhandle"
            value={values.social_instagram}
            onChange={e => onChange({ social_instagram: e.target.value })}
            icon={
              /* Camera icon */
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />

          {/* Facebook */}
          <Input
            id="social_facebook"
            label="Facebook Profile URL"
            placeholder="https://facebook.com/yourprofile"
            value={values.social_facebook}
            onChange={e => onChange({ social_facebook: e.target.value })}
            icon={
              /* User icon */
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
        </section>
      )}
    </div>
  )
}
