'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

const STORAGE_KEY = 'lumidex_collection_onboarding_seen'

const STEPS: { icon: string; text: string }[] = [
  {
    icon: '🗂️',
    text: 'Browse to any set page from the Sets section.',
  },
  {
    icon: '🃏',
    text: 'Click on a card to open its detail panel.',
  },
  {
    icon: '✨',
    text: 'Select your variant — Normal, Reverse Holo, Cosmos Holo, and more.',
  },
  {
    icon: '✓',
    text: 'Left-click a variant dot to add a copy, or use the + / − buttons inside the card detail to set the exact quantity.',
  },
  {
    icon: '📈',
    text: "Watch your progress bar fill up as you track your way to completing the set!",
  },
]

export default function CollectionOnboardingModal() {
  const [isOpen, setIsOpen] = useState(false)

  // Only run on the client — check localStorage after hydration.
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) {
        setIsOpen(true)
      }
    } catch {
      // localStorage unavailable (e.g. private browsing with strict settings) — skip silently.
    }
  }, [])

  function handleDismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Non-fatal — modal simply won't remember it was shown.
    }
    setIsOpen(false)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      title="How to Add Cards to Your Collection"
      maxWidth="md"
    >
      <div className="flex flex-col gap-5">
        {/* Intro */}
        <p className="text-sm text-secondary leading-relaxed">
          Welcome to Lumidex! Here&rsquo;s how to start building your collection in just a few clicks.
        </p>

        {/* Step list */}
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, idx) => (
            <li key={idx} className="flex items-start gap-3">
              {/* Step number bubble */}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              {/* Icon + text */}
              <div className="flex items-start gap-2">
                <span className="text-base leading-none mt-0.5" aria-hidden>
                  {step.icon}
                </span>
                <span className="text-sm text-secondary leading-relaxed">{step.text}</span>
              </div>
            </li>
          ))}
        </ol>

        {/* Tip callout */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 flex items-start gap-3">
          <span className="text-base leading-none mt-0.5 flex-shrink-0" aria-hidden>💡</span>
          <p className="text-xs text-secondary leading-relaxed">
            <strong className="text-primary font-semibold">Tip:</strong> You can also right-click a variant dot directly on the set page to decrease a card&rsquo;s quantity — no need to open the detail view.
          </p>
        </div>

        {/* Dismiss button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={handleDismiss}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent-light transition-colors cursor-pointer"
          >
            Got it!
          </button>
        </div>
      </div>
    </Modal>
  )
}
