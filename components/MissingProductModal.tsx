'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface MissingProductModalProps {
  isOpen:  boolean
  onClose: () => void
}

export default function MissingProductModal({
  isOpen,
  onClose,
}: MissingProductModalProps) {
  const [form, setForm] = useState({
    productName: '',
    setName:     '',
    productType: '',
  })
  const [isSubmitting,  setIsSubmitting]  = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!form.productName.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const response = await fetch('/api/missing-card-suggestions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name:   `[PRODUCT] ${form.productName.trim()}`,
          set_name:    form.setName.trim()     || null,
          card_number: null,
          variant:     form.productType.trim() || null,
        }),
      })

      if (!response.ok) throw new Error('Failed to submit report')

      setSubmitSuccess(true)
      setForm({ productName: '', setName: '', productType: '' })
    } catch (err) {
      console.error('[MissingProductModal] submit error:', err)
      setSubmitError('Failed to submit report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    setForm({ productName: '', setName: '', productType: '' })
    setSubmitError(null)
    setSubmitSuccess(false)
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleClose}>

        {/* Backdrop */}
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

        {/* Modal container */}
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
                      Report Missing Product
                    </Dialog.Title>
                    <p className="text-xs text-muted mt-0.5">
                      Let us know about a sealed product that&apos;s missing from the database
                    </p>
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
                  {submitSuccess ? (
                    <div className="py-4 text-center space-y-4">
                      <div className="px-4 py-3 rounded-xl bg-[rgba(52,211,153,0.1)] border border-[rgba(52,211,153,0.3)] text-price text-sm flex items-center gap-2 justify-center">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Report submitted — thanks for helping improve Lumidex!
                      </div>
                      <Button variant="ghost" onClick={handleClose}>Close</Button>
                    </div>
                  ) : (
                    <>
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
                        onSubmit={e => { e.preventDefault(); handleSubmit() }}
                        className="space-y-4"
                      >
                        <Input
                          label="Product Name"
                          type="text"
                          value={form.productName}
                          onChange={e => setForm(prev => ({ ...prev, productName: e.target.value }))}
                          placeholder="e.g. Scarlet & Violet Booster Box"
                          required
                          disabled={isSubmitting}
                        />

                        <Input
                          label="Set Name"
                          type="text"
                          value={form.setName}
                          onChange={e => setForm(prev => ({ ...prev, setName: e.target.value }))}
                          placeholder="e.g. Scarlet & Violet"
                          disabled={isSubmitting}
                        />

                        <Input
                          label="Product Type (optional)"
                          type="text"
                          value={form.productType}
                          onChange={e => setForm(prev => ({ ...prev, productType: e.target.value }))}
                          placeholder="e.g. Booster Box, ETB, Tin…"
                          disabled={isSubmitting}
                        />

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
                            disabled={!form.productName.trim() || isSubmitting}
                            loading={isSubmitting}
                          >
                            {isSubmitting ? 'Submitting…' : 'Submit Report'}
                          </Button>
                        </div>
                      </form>
                    </>
                  )}
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
