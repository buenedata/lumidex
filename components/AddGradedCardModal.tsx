'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import {
  GRADING_COMPANIES,
  GRADES_BY_COMPANY,
  type GradingCompany,
  type PokemonCard,
  type VariantWithQuantity,
} from '@/types'

// ── Company display config ────────────────────────────────────────────────────

const COMPANY_STYLE: Record<GradingCompany, {
  label: string
  activeBg: string
  activeBorder: string
  activeText: string
}> = {
  PSA: {
    label: 'PSA',
    activeBg:     'bg-blue-900/60',
    activeBorder: 'border-blue-400',
    activeText:   'text-blue-300',
  },
  BECKETT: {
    label: 'BECKETT',
    activeBg:     'bg-red-900/60',
    activeBorder: 'border-red-400',
    activeText:   'text-red-300',
  },
  CGC: {
    label: 'CGC',
    activeBg:     'bg-orange-900/60',
    activeBorder: 'border-orange-400',
    activeText:   'text-orange-300',
  },
  TAG: {
    label: 'TAG',
    activeBg:     'bg-slate-700/80',
    activeBorder: 'border-slate-300',
    activeText:   'text-slate-200',
  },
  ACE: {
    label: 'ACE',
    activeBg:     'bg-yellow-900/60',
    activeBorder: 'border-yellow-400',
    activeText:   'text-yellow-300',
  },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddGradedCardModalProps {
  isOpen: boolean
  onClose: () => void
  card: PokemonCard
  setName?: string | null
  setComplete?: number | null
  setTotal?: number
  /** set_id used to auto-add the set to user_sets on first card added */
  setId: string
  /** filteredVariants already loaded in CardGrid — passed down to avoid a re-fetch */
  variants: VariantWithQuantity[]
  userId: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddGradedCardModal({
  isOpen,
  onClose,
  card,
  setName,
  setComplete,
  setTotal,
  setId,
  variants,
  userId,
}: AddGradedCardModalProps) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedCompany, setSelectedCompany] = useState<GradingCompany>('PSA')
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [selectedGrade, setSelectedGrade]         = useState<string>('')
  const [quantity, setQuantity]                   = useState(1)

  // ── Submission state ────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage]     = useState<string | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────────
  const grades = GRADES_BY_COMPANY[selectedCompany]

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Reset to sensible defaults whenever the modal opens or the card changes
  useEffect(() => {
    if (!isOpen) return
    setSelectedCompany('PSA')
    setSelectedVariantId(
      variants.find(v => v.is_quick_add)?.id ?? variants[0]?.id ?? '',
    )
    const psaGrades = GRADES_BY_COMPANY['PSA']
    setSelectedGrade(psaGrades[psaGrades.length - 1] ?? '')
    setQuantity(1)
    setSuccessMessage(null)
    setErrorMessage(null)
  }, [isOpen, card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // When company changes, reset grade to the best grade for that company
  const handleCompanyChange = (company: GradingCompany) => {
    setSelectedCompany(company)
    const companyGrades = GRADES_BY_COMPANY[company]
    setSelectedGrade(companyGrades[companyGrades.length - 1] ?? '')
    setSuccessMessage(null)
    setErrorMessage(null)
  }

  // ── Submission ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedGrade) return
    setIsSubmitting(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/graded-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId:         card.id,
          variantId:      selectedVariantId || null,
          gradingCompany: selectedCompany,
          grade:          selectedGrade,
          quantity,
          setId,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to add graded card')
      }

      setSuccessMessage(
        `Added ${selectedCompany} ${selectedGrade} × ${quantity} to your collection!`,
      )

      // Auto-close after a short delay so the user sees the success message
      setTimeout(() => {
        setSuccessMessage(null)
        onClose()
      }, 1800)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Card number display ──────────────────────────────────────────────────────
  const displayNumber = (() => {
    if (!card.number) return 'N/A'
    const num = card.number.split('/')[0]
    const total = card.number.includes('/')
      ? card.number.split('/')[1]
      : setComplete ?? setTotal
    return total ? `${num}/${total}` : num
  })()

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="flex flex-col gap-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Add Graded Card</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary text-xl transition-colors p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Card identity row ── */}
        <div className="flex gap-4 items-center">
          {/* Thumbnail */}
          <div className="shrink-0 w-24 rounded-lg overflow-hidden border border-subtle shadow-md">
            <img
              src={card.image ?? card.image_url ?? '/pokemon_card_backside.png'}
              alt={card.name ?? 'Card'}
              className="w-full h-auto object-contain"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-primary truncate">
              {card.name ?? 'Unknown Card'}
            </p>
            {setName && (
              <p className="text-xs text-muted truncate mt-0.5">{setName}</p>
            )}
            <p className="text-xs text-muted mt-0.5">#{displayNumber}</p>
          </div>
        </div>

        {/* ── Grading company selector ── */}
        <div>
          <div className="flex flex-wrap gap-2">
            {GRADING_COMPANIES.map(company => {
              const style    = COMPANY_STYLE[company]
              const isActive = company === selectedCompany
              return (
                <button
                  key={company}
                  onClick={() => handleCompanyChange(company)}
                  className={[
                    'px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
                    isActive
                      ? `${style.activeBg} ${style.activeBorder} ${style.activeText}`
                      : 'bg-elevated border-subtle text-muted hover:text-primary hover:border-muted',
                  ].join(' ')}
                >
                  {style.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Variant + Grade ── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Variant */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              Variant
            </label>
            {variants.length === 0 ? (
              <p className="text-xs text-muted italic">No variants available</p>
            ) : (
              <div className="relative">
                <select
                  value={selectedVariantId}
                  onChange={e => setSelectedVariantId(e.target.value)}
                  className="w-full appearance-none bg-elevated border border-subtle rounded-lg px-3 py-2 pr-8 text-sm text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Grade / Condition */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              Condition
            </label>
            <div className="relative">
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
                className="w-full appearance-none bg-elevated border border-subtle rounded-lg px-3 py-2 pr-8 text-sm text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                {grades.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quantity ── */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Quantity
          </label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full bg-elevated border border-subtle rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        {/* ── Feedback messages ── */}
        {successMessage && (
          <div className="rounded-lg bg-green-900/40 border border-green-700 px-4 py-2.5 text-sm text-green-300">
            ✓ {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedGrade || !!successMessage}
          className="w-full py-3 px-4 bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium text-sm"
        >
          {isSubmitting ? 'Adding…' : 'Add Card'}
        </button>

      </div>
    </Modal>
  )
}
