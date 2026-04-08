'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import SettingsForm, { SettingsValues } from './SettingsForm'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  initialValues: SettingsValues
  /** Called after a successful save so the profile page can refresh displayed data */
  onSaved: (values: SettingsValues) => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  userId,
  initialValues,
  onSaved,
}: SettingsModalProps) {
  const [values, setValues] = useState<SettingsValues>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Reset local state each time the modal opens so edits don't bleed between sessions
  useEffect(() => {
    if (isOpen) {
      setValues(initialValues)
      setError(null)
      setSaved(false)
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
        display_name:              values.display_name || null,
        bio:                       values.bio || null,
        location:                  values.location || null,
        preferred_language:        values.preferred_language,
        preferred_currency:        values.preferred_currency,
        price_source:              values.price_source,
        grey_out_unowned:          values.grey_out_unowned,
        profile_private:           values.profile_private,
        show_portfolio_value:      values.show_portfolio_value,
        lists_public_by_default:   values.lists_public_by_default,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      setError('Failed to save settings. Please try again.')
      return
    }

    setSaved(true)
    onSaved(values)

    // Auto-close after short delay
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 800)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile Settings"
      maxWidth="lg"
    >
      <div className="overflow-y-auto max-h-[60vh] pr-1">
        <SettingsForm
          values={values}
          onChange={handleChange}
          sections={['identity', 'locale', 'display', 'privacy']}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-subtle">
        {error && (
          <p className="text-xs text-[var(--danger)]">{error}</p>
        )}
        {saved && !error && (
          <p className="text-xs text-[var(--success)]">✓ Settings saved</p>
        )}
        {!error && !saved && <span />}

        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
