'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PokemonCard } from '@/types'
import { cn } from '@/lib/utils'

interface VariantSuggestionModalProps {
  isOpen: boolean
  selectedCard: PokemonCard | null
  userId: string
  onClose: () => void
}

export default function VariantSuggestionModal({
  isOpen,
  selectedCard,
  userId,
  onClose
}: VariantSuggestionModalProps) {
  const [suggestionForm, setSuggestionForm] = useState({ name: '', description: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleVariantSuggestion = async () => {
    if (!selectedCard || !userId || !suggestionForm.name.trim()) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const response = await fetch('/api/variant-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: selectedCard.id,
          name: suggestionForm.name.trim(),
          description: suggestionForm.description.trim() || null,
          userId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit suggestion')
      }

      // Reset form and show success
      setSuggestionForm({ name: '', description: '' })
      setSubmitSuccess(true)

      // Auto-close after brief success display
      setTimeout(() => {
        setSubmitSuccess(false)
        onClose()
      }, 1500)
    } catch (error) {
      console.error('Failed to submit variant suggestion:', error)
      setSubmitError('Failed to submit suggestion. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setSuggestionForm({ name: '', description: '' })
      setSubmitError(null)
      setSubmitSuccess(false)
      onClose()
    }
  }

  return (
    <Transition appear show={isOpen && !!selectedCard} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleClose}>

        {/* ── Backdrop ───────────────────────────────────────────────── */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        {/* ── Modal container ─────────────────────────────────────────── */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95 translate-y-1"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-1"
            >
              <Dialog.Panel className="relative z-10 w-full max-w-md transform text-left align-middle transition-all bg-elevated border border-subtle rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
                  <div>
                    <Dialog.Title
                      className="text-lg font-semibold text-primary"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      Suggest New Variant
                    </Dialog.Title>
                    {selectedCard && (
                      <p className="text-xs text-muted mt-0.5">
                        for <span className="text-secondary">{selectedCard.name}</span>
                        {selectedCard.number && (
                          <span className="text-muted"> #{selectedCard.number}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-surface transition-all disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4">

                  {/* Success message */}
                  {submitSuccess && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.3)] text-price text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Variant suggestion submitted successfully!
                    </div>
                  )}

                  {/* Error message */}
                  {submitError && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      {submitError}
                    </div>
                  )}

                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      handleVariantSuggestion()
                    }}
                    className="space-y-4"
                  >
                    {/* Variant Name */}
                    <Input
                      label="Variant Name"
                      type="text"
                      value={suggestionForm.name}
                      onChange={e =>
                        setSuggestionForm(prev => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="e.g., Shiny, First Edition, Prerelease…"
                      required
                      disabled={isSubmitting}
                    />

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-secondary">
                        Description{' '}
                        <span className="text-muted font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={suggestionForm.description}
                        onChange={e =>
                          setSuggestionForm(prev => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="Brief description of this variant…"
                        disabled={isSubmitting}
                        rows={3}
                        className={cn(
                          'w-full bg-surface border border-subtle rounded-lg px-3 py-2',
                          'text-sm text-primary placeholder:text-muted',
                          'transition-colors duration-150 resize-none',
                          'hover:border-[rgba(255,255,255,0.15)]',
                          'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex-1"
                        onClick={handleClose}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        className="flex-1"
                        disabled={!suggestionForm.name.trim() || isSubmitting}
                        loading={isSubmitting}
                      >
                        {isSubmitting ? 'Submitting…' : 'Submit'}
                      </Button>
                    </div>
                  </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
