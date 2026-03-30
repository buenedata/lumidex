'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import SettingsForm, { SettingsValues, defaultSettings } from './SettingsForm'
import AvatarUpload from './AvatarUpload'
import BannerUpload from './BannerUpload'

interface FirstTimeSetupModalProps {
  userId: string
  username: string
  currentAvatarUrl?: string | null
  currentBannerUrl?: string | null
  /** Called after successful save (skip or finish) with the saved values */
  onComplete: (values: SettingsValues, avatarUrl: string | null, bannerUrl: string | null) => void
}

const STEPS = [
  { label: 'Identity', index: 0 },
  { label: 'Locale',   index: 1 },
  { label: 'Privacy',  index: 2 },
] as const

type StepIndex = 0 | 1 | 2

const STEP_SECTIONS: Record<StepIndex, Array<'identity' | 'locale' | 'display' | 'privacy'>> = {
  0: ['identity'],
  1: ['locale', 'display'],
  2: ['privacy'],
}

export default function FirstTimeSetupModal({
  userId,
  username,
  currentAvatarUrl,
  currentBannerUrl,
  onComplete,
}: FirstTimeSetupModalProps) {
  const [step, setStep] = useState<StepIndex>(0)
  const [values, setValues] = useState<SettingsValues>(defaultSettings)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl ?? null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(currentBannerUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initials = username.slice(0, 2).toUpperCase()

  function handleChange(patch: Partial<SettingsValues>) {
    setValues(prev => ({ ...prev, ...patch }))
  }

  async function save(skipAll?: boolean) {
    setSaving(true)
    setError(null)

    const payload = skipAll
      ? { setup_completed: true }
      : {
          display_name: values.display_name || null,
          bio: values.bio || null,
          location: values.location || null,
          preferred_language: values.preferred_language,
          preferred_currency: values.preferred_currency,
          price_source: values.price_source,
          grey_out_unowned: values.grey_out_unowned,
          profile_private: values.profile_private,
          show_portfolio_value: values.show_portfolio_value,
          setup_completed: true,
        }

    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)

    if (!res.ok) {
      setError('Failed to save settings. Please try again.')
      return
    }

    onComplete(skipAll ? defaultSettings : values, avatarUrl, bannerUrl)
  }

  function goBack() {
    if (step > 0) setStep((step - 1) as StepIndex)
  }

  function goNext() {
    if (step < 2) setStep((step + 1) as StepIndex)
  }

  return (
    // Full-screen overlay — not dismissable
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className={cn(
          'w-full max-w-lg bg-surface border border-subtle rounded-2xl shadow-2xl',
          'flex flex-col max-h-[90vh]'
        )}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-subtle flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2
              className="text-xl font-bold text-primary"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Welcome to Lumidex ✨
            </h2>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="text-xs text-muted hover:text-secondary transition-colors duration-150"
            >
              Skip setup
            </button>
          </div>
          <p className="text-sm text-secondary">
            Let&apos;s personalise your profile in a few quick steps.
          </p>
        </div>

        {/* ── Stepper ──────────────────────────────────────────── */}
        <div className="px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const isActive    = step === s.index
              const isCompleted = step > s.index

              return (
                <div key={s.index} className="flex items-center flex-1 last:flex-none">
                  {/* Pill */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
                        isCompleted
                          ? 'bg-accent text-white'
                          : isActive
                          ? 'bg-accent text-white ring-4 ring-accent/25'
                          : 'bg-surface border-2 border-subtle text-muted'
                      )}
                    >
                      {isCompleted ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        s.index + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-xs transition-colors duration-200',
                        isActive ? 'text-accent font-medium' : 'text-muted'
                      )}
                    >
                      {s.label}
                    </span>
                  </div>

                  {/* Connector line — not after last step */}
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-px mx-2 mb-5 transition-colors duration-200',
                        isCompleted ? 'bg-accent' : 'bg-subtle'
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Step content ─────────────────────────────────────── */}
        <div className="px-6 pb-4 overflow-y-auto flex-1">

          {/* Step 0: Identity & Photos */}
          {step === 0 && (
            <div className="flex flex-col gap-5">
              {/* Banner picker */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Profile Banner
                </label>
                <BannerUpload
                  currentUrl={bannerUrl}
                  onUploaded={url => setBannerUrl(url)}
                  editable
                  variant="compact"
                  className="rounded-xl"
                />
              </div>

              {/* Avatar + display name row */}
              <div className="flex items-end gap-4">
                <AvatarUpload
                  currentUrl={avatarUrl}
                  initials={initials}
                  onUploaded={url => setAvatarUrl(url)}
                  editable
                  size="md"
                  className="flex-shrink-0"
                />
                <div className="flex-1 pb-0.5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="wizard_display_name" className="text-xs font-medium text-secondary">
                      Display Name
                    </label>
                    <input
                      id="wizard_display_name"
                      type="text"
                      placeholder="How you appear to others"
                      value={values.display_name}
                      maxLength={50}
                      onChange={e => handleChange({ display_name: e.target.value })}
                      className={cn(
                        'w-full h-9 bg-surface border border-subtle rounded-lg px-3 text-sm text-primary',
                        'placeholder:text-muted transition-colors duration-150',
                        'hover:border-[rgba(255,255,255,0.15)]',
                        'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Bio + location */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="wizard_bio" className="text-xs font-medium text-secondary">
                  Bio
                </label>
                <textarea
                  id="wizard_bio"
                  rows={3}
                  placeholder="Tell the community a little about yourself…"
                  value={values.bio}
                  maxLength={280}
                  onChange={e => handleChange({ bio: e.target.value })}
                  className={cn(
                    'w-full bg-surface border border-subtle rounded-lg px-3 py-2 text-sm text-primary resize-none',
                    'placeholder:text-muted transition-colors duration-150',
                    'hover:border-[rgba(255,255,255,0.15)]',
                    'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30'
                  )}
                />
                <p className="text-xs text-muted text-right">{values.bio.length}/280</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="wizard_location" className="text-xs font-medium text-secondary">
                  Location
                </label>
                <input
                  id="wizard_location"
                  type="text"
                  placeholder="e.g. Oslo, Norway"
                  value={values.location}
                  maxLength={80}
                  onChange={e => handleChange({ location: e.target.value })}
                  className={cn(
                    'w-full h-9 bg-surface border border-subtle rounded-lg px-3 text-sm text-primary',
                    'placeholder:text-muted transition-colors duration-150',
                    'hover:border-[rgba(255,255,255,0.15)]',
                    'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30'
                  )}
                />
              </div>
            </div>
          )}

          {/* Step 1: Locale & Display */}
          {step === 1 && (
            <SettingsForm
              values={values}
              onChange={handleChange}
              sections={STEP_SECTIONS[1]}
            />
          )}

          {/* Step 2: Privacy */}
          {step === 2 && (
            <SettingsForm
              values={values}
              onChange={handleChange}
              sections={STEP_SECTIONS[2]}
            />
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-subtle flex-shrink-0 flex items-center justify-between">
          {/* Error */}
          {error && (
            <p className="text-xs text-[var(--danger)] mr-auto">{error}</p>
          )}

          <div className={cn('flex gap-3 ml-auto', error && 'mt-0')}>
            {step > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={goBack}
                disabled={saving}
              >
                ← Back
              </Button>
            )}

            {step < 2 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={goNext}
              >
                Continue →
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => save(false)}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Finish Setup ✓'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
