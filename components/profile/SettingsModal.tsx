'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import SettingsForm, { SettingsValues } from './SettingsForm'
import { useIsPro } from '@/hooks/useProGate'
import { ProBadge } from '@/components/upgrade/ProBadge'
import { useLocale } from '@/contexts/LocaleContext'

// ── Danger-zone confirmation sub-modal ───────────────────────────────────────

type DangerAction = 'reset_collection' | 'delete_account'

interface ConfirmDangerModalProps {
  action: DangerAction | null
  username: string
  onClose: () => void
  onConfirmed: (action: DangerAction) => Promise<void>
  isExecuting: boolean
}

function ConfirmDangerModal({
  action,
  username,
  onClose,
  onConfirmed,
  isExecuting,
}: ConfirmDangerModalProps) {
  const { t } = useLocale()
  const [typed, setTyped] = useState('')

  // Reset input each time the sub-modal opens
  useEffect(() => {
    if (action) setTyped('')
  }, [action])

  if (!action) return null

  const isReset   = action === 'reset_collection'
  const title     = isReset ? t('settings_reset_collection') : t('settings_delete_account')
  const warning   = isReset ? t('settings_reset_warning') : t('settings_delete_warning')
  const btnLabel  = isReset ? t('settings_confirm_reset') : t('settings_confirm_delete')
  const busyLabel = isReset ? t('settings_resetting') : t('settings_deleting')

  const confirmed = typed.trim().toLowerCase() === username.toLowerCase()

  return (
    <Modal isOpen={!!action} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex flex-col gap-4">
        {/* Warning box */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-400 leading-relaxed">{warning}</p>
        </div>

        {/* Typed username confirmation */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-secondary">
            {t('settings_type_username', { handle: `@${username}` })}
          </label>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={username}
            autoComplete="off"
            spellCheck={false}
            className={cn(
              'w-full h-9 bg-surface border rounded-lg px-3 text-sm text-primary placeholder:text-muted',
              'focus:outline-none transition-colors',
              confirmed
                ? 'border-red-500 focus:ring-1 focus:ring-red-500/30'
                : 'border-subtle focus:border-[rgba(255,255,255,0.15)]'
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isExecuting}>
            {t('settings_cancel')}
          </Button>
          <button
            type="button"
            disabled={!confirmed || isExecuting}
            onClick={() => onConfirmed(action)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
              confirmed && !isExecuting
                ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                : 'bg-red-600/30 text-red-400/40 cursor-not-allowed'
            )}
          >
            {isExecuting ? busyLabel : btnLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main SettingsModal ────────────────────────────────────────────────────────

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  /** The user's @username — used for typed confirmation in the danger zone */
  username: string
  initialValues: SettingsValues
  /** Called after a successful save so the profile page can refresh displayed data */
  onSaved: (values: SettingsValues) => void
  /** Called after the user resets their collection (allows parent to refresh UI) */
  onCollectionReset?: () => void
  /** Called after the user deletes their account (before redirect) */
  onAccountDeleted?: () => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  userId,
  username,
  initialValues,
  onSaved,
  onCollectionReset,
  onAccountDeleted,
}: SettingsModalProps) {
  const router = useRouter()
  const isPro  = useIsPro()
  const { t }  = useLocale()

  const [values,  setValues]  = useState<SettingsValues>(initialValues)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  // Billing portal loading
  const [billingLoading, setBillingLoading] = useState(false)

  // Danger zone
  const [dangerAction,    setDangerAction]    = useState<DangerAction | null>(null)
  const [dangerExecuting, setDangerExecuting] = useState(false)
  const [dangerError,     setDangerError]     = useState<string | null>(null)

  // Reset local state each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setValues(initialValues)
      setError(null)
      setSaved(false)
      setDangerAction(null)
      setDangerError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function handleChange(patch: Partial<SettingsValues>) {
    setSaved(false)
    setValues(prev => ({ ...prev, ...patch }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name:            values.display_name             || null,
        bio:                     values.bio                      || null,
        location:                values.location                 || null,
        preferred_language:      values.preferred_language,
        preferred_currency:      values.preferred_currency,
        grey_out_unowned:        values.grey_out_unowned,
        profile_private:         values.profile_private,
        lists_public_by_default: values.lists_public_by_default,
        social_cardmarket:       values.social_cardmarket        || null,
        social_instagram:        values.social_instagram         || null,
        social_facebook:         values.social_facebook          || null,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      setError(t('settings_save_error'))
      return
    }

    setSaved(true)
    onSaved(values)

    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 800)
  }

  async function handleDangerConfirmed(action: DangerAction) {
    setDangerExecuting(true)
    setDangerError(null)

    try {
      if (action === 'reset_collection') {
        const res = await fetch('/api/user/collection', { method: 'DELETE' })
        if (!res.ok) throw new Error(t('settings_save_error'))
        setDangerAction(null)
        onCollectionReset?.()
        onClose()
      } else {
        const res = await fetch('/api/user/account', { method: 'DELETE' })
        if (!res.ok) throw new Error(t('settings_save_error'))
        onAccountDeleted?.()
        router.push('/')
      }
    } catch (err) {
      setDangerError(err instanceof Error ? err.message : t('settings_save_error'))
    } finally {
      setDangerExecuting(false)
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('settings_save_error'))
      window.location.href = data.url
    } catch {
      // Portal failure is non-critical — just stop loading
      setBillingLoading(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('settings_modal_title')}
        maxWidth="lg"
      >
        <div className="overflow-y-auto max-h-[90vh] pr-1">
          <SettingsForm
            values={values}
            onChange={handleChange}
            sections={['identity', 'social', 'locale', 'display', 'privacy']}
          />

          {/* ── Subscription ─────────────────────────────────── */}
          <div className="mt-6 pt-6 border-t border-[#2a2a3d]">
            <h3 className="text-xs font-semibold text-[#9191b0] uppercase tracking-wider mb-3">
              {t('settings_section_subscription')}
            </h3>
            {isPro ? (
              <div className="flex items-center justify-between gap-4 bg-[rgba(109,95,255,0.08)] border border-[rgba(109,95,255,0.25)] rounded-xl px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">Lumidex Pro</p>
                    <ProBadge size="sm" />
                  </div>
                  <p className="text-xs text-[#9191b0] mt-0.5">{t('settings_pro_active')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#9191b0] border border-[#2a2a3d] hover:border-[#6d5fff] hover:text-white transition-all duration-150 disabled:opacity-60"
                >
                  {billingLoading ? t('settings_billing_opening') : t('settings_manage_billing')}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 bg-[#111118] border border-[#2a2a3d] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{t('settings_free_plan')}</p>
                  <p className="text-xs text-[#9191b0] mt-0.5">
                    {t('settings_upgrade_cta')}
                  </p>
                </div>
                <Link
                  href="/upgrade"
                  onClick={onClose}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white
                    bg-[#6d5fff] hover:bg-[#8577ff]
                    shadow-[0_0_10px_rgba(109,95,255,0.3)]
                    transition-all duration-150"
                >
                  {t('settings_upgrade_link')}
                </Link>
              </div>
            )}
          </div>

          {/* ── Danger Zone ──────────────────────────────────── */}
          <div className="mt-8 pt-6 border-t border-red-500/20">
            <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">
              {t('settings_section_danger')}
            </h3>
            <p className="text-xs text-muted mb-4 leading-snug">
              {t('settings_danger_desc')}
            </p>

            <div className="flex flex-col gap-3">
              {/* Reset collection */}
              <div className="flex items-center justify-between gap-4 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-primary">{t('settings_reset_collection')}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {t('settings_reset_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDangerError(null); setDangerAction('reset_collection') }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-150"
                >
                  {t('settings_reset_btn')}
                </button>
              </div>

              {/* Delete account */}
              <div className="flex items-center justify-between gap-4 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-primary">{t('settings_delete_account')}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {t('settings_delete_desc')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDangerError(null); setDangerAction('delete_account') }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-500/40 hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-150"
                >
                  {t('settings_delete_btn')}
                </button>
              </div>
            </div>

            {dangerError && (
              <p className="text-xs text-red-400 mt-3">{dangerError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-subtle">
          {error && (
            <p className="text-xs text-[var(--danger)]">{error}</p>
          )}
          {saved && !error && (
            <p className="text-xs text-[var(--success)]">{t('settings_saved')}</p>
          )}
          {!error && !saved && <span />}

          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              {t('settings_cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? t('settings_saving') : t('settings_save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Danger-zone confirmation sub-modal (renders above the settings modal) */}
      <ConfirmDangerModal
        action={dangerAction}
        username={username}
        onClose={() => setDangerAction(null)}
        onConfirmed={handleDangerConfirmed}
        isExecuting={dangerExecuting}
      />
    </>
  )
}
