'use client'

import { useState } from 'react'
import { GAMES, type GameSlug } from '@/lib/games'

import { GamePicker } from './GamePicker'
import { SetSelector } from './SetSelector'

import { CardImageGrid, type CardGridItem } from './CardImageGrid'
import { CardImageUploadModal } from './CardImageUploadModal'
import { BulkImageImport } from './BulkImageImport'

import { SetImageGrid, type SetGridItem } from './SetImageGrid'
import { SetImageUploadModal } from './SetImageUploadModal'

// ── Wizard step type ──────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 'card-upload' | 'set-upload'

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
        active ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400'
      }`}
    >
      {n}
    </span>
  )
}

// ── Breadcrumb bar ────────────────────────────────────────────────────────────

interface BreadcrumbProps {
  selectedGame: GameSlug | null
  selectedSetName: string | null
  imageType: 'card' | 'set' | null
  onClickGame: () => void
  onClickSet: () => void
}

function Breadcrumb({ selectedGame, selectedSetName, imageType, onClickGame, onClickSet }: BreadcrumbProps) {
  const gameName = selectedGame ? GAMES[selectedGame]?.displayName : null

  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap mb-6">
      {gameName ? (
        <button onClick={onClickGame} className="text-yellow-400 hover:underline font-medium">
          {gameName}
        </button>
      ) : (
        <span>Choose TCG</span>
      )}

      {selectedSetName && (
        <>
          <span>/</span>
          <button onClick={onClickSet} className="text-yellow-400 hover:underline font-medium">
            {selectedSetName}
          </button>
        </>
      )}

      {imageType && (
        <>
          <span>/</span>
          <span className="text-white font-medium">
            {imageType === 'card' ? 'Card Images' : 'Set Image'}
          </span>
        </>
      )}
    </div>
  )
}

// ── Upload-type option card ───────────────────────────────────────────────────

interface TypeCardProps {
  icon: string
  label: string
  description: string
  onClick: () => void
}

function TypeCard({ icon, label, description, onClick }: TypeCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-700 bg-gray-900 hover:border-yellow-500/60 hover:bg-gray-800 transition-all duration-150 group text-center"
    >
      <span className="text-4xl">{icon}</span>
      <div>
        <p className="font-semibold text-white group-hover:text-yellow-300 text-base">{label}</p>
        <p className="text-gray-500 text-sm mt-1 leading-snug">{description}</p>
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ImageUploadWizard() {
  // ── Wizard navigation state ─────────────────────────────────────────────
  const [step, setStep]                     = useState<WizardStep>(1)
  const [selectedGame, setSelectedGame]     = useState<GameSlug | null>(null)
  const [selectedSetId, setSelectedSetId]   = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null)
  const [imageType, setImageType]           = useState<'card' | 'set' | null>(null)

  // ── Set selector refresh ────────────────────────────────────────────────
  const [selectorRefreshKey, setSelectorRefreshKey] = useState(0)

  // ── Card upload state (mirrors CardImagesTab) ───────────────────────────
  const [selectedCard, setSelectedCard]         = useState<CardGridItem | null>(null)
  const [cardList, setCardList]                 = useState<CardGridItem[]>([])
  const [cardModalOpen, setCardModalOpen]       = useState(false)
  const [cardGridRefreshKey, setCardGridRefreshKey] = useState(0)
  const [imageOverrides, setImageOverrides]     = useState<Record<string, string>>({})

  // ── Set upload state (mirrors SetImagesTab) ─────────────────────────────
  const [selectedSet, setSelectedSet]           = useState<SetGridItem | null>(null)
  const [setList, setSetList]                   = useState<SetGridItem[]>([])
  const [setModalOpen, setSetModalOpen]         = useState(false)
  const [setGridRefreshKey, setSetGridRefreshKey] = useState(0)

  // ── Navigation helpers ──────────────────────────────────────────────────

  const goToStep1 = () => {
    setStep(1)
    setSelectedGame(null)
    setSelectedSetId(null)
    setSelectedSetName(null)
    setImageType(null)
  }

  const goToStep2 = () => {
    setStep(2)
    setSelectedSetId(null)
    setSelectedSetName(null)
    setImageType(null)
  }

  const handleGameSelect = (slug: GameSlug) => {
    setSelectedGame(slug)
    setStep(2)
  }

  const handleSetSelect = (setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
    setStep(3)
  }

  const handleTypeSelect = (type: 'card' | 'set') => {
    setImageType(type)
    setStep(type === 'card' ? 'card-upload' : 'set-upload')
  }

  // ── Card upload handlers ────────────────────────────────────────────────

  const handleCardSelect = (card: CardGridItem) => {
    setSelectedCard(card)
    setCardModalOpen(true)
  }

  const handleCardUploadSuccess = (cardId: string, imageUrl: string) => {
    setImageOverrides((prev) => ({ ...prev, [cardId]: imageUrl }))
    setCardGridRefreshKey((k) => k + 1)
  }

  const handleCardsLoaded = (cards: CardGridItem[]) => {
    setCardList(cards)
    setSelectedCard((prev) => {
      if (!prev) return prev
      return cards.find((c) => c.id === prev.id) ?? prev
    })
  }

  const handleNextCard = () => {
    if (!selectedCard || cardList.length === 0) return
    const idx = cardList.findIndex((c) => c.id === selectedCard.id)
    const next = cardList[idx + 1]
    if (next) setSelectedCard(next)
  }

  const currentCardIndex = selectedCard ? cardList.findIndex((c) => c.id === selectedCard.id) : -1
  const hasNextCard = currentCardIndex >= 0 && currentCardIndex < cardList.length - 1

  // ── Set upload handlers ─────────────────────────────────────────────────

  const handleSetGridSelect = (set: SetGridItem) => {
    setSelectedSet(set)
    setSetModalOpen(true)
  }

  const handleSetUploadSuccess = (_setId: string, logoUrl: string) => {
    setSelectedSet((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev))
    setSetGridRefreshKey((k) => k + 1)
  }

  const handleNextSet = () => {
    if (!selectedSet || setList.length === 0) return
    const idx = setList.findIndex((s) => s.id === selectedSet.id)
    const next = setList[idx + 1]
    if (next) setSelectedSet(next)
  }

  const currentSetIndex = selectedSet ? setList.findIndex((s) => s.id === selectedSet.id) : -1
  const hasNextSet = currentSetIndex >= 0 && currentSetIndex < setList.length - 1

  // ── Derived ─────────────────────────────────────────────────────────────

  const showBreadcrumb = step !== 1

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Breadcrumb */}
      {showBreadcrumb && (
        <Breadcrumb
          selectedGame={selectedGame}
          selectedSetName={selectedSetName}
          imageType={imageType}
          onClickGame={goToStep1}
          onClickSet={() => setStep(3)}
        />
      )}

      {/* ── Step 1: Choose TCG ─────────────────────────────────────────── */}
      {step === 1 && (
        <section>
          <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2 mb-4">
            <StepBadge n={1} active />
            Choose a TCG
          </h2>
          <GamePicker selectedGame={selectedGame} onGameSelect={handleGameSelect} />
        </section>
      )}

      {/* ── Step 2: Choose a set ───────────────────────────────────────── */}
      {step === 2 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
              <StepBadge n={2} active />
              Choose a set
              {selectedGame && (
                <span className="text-gray-400 font-normal text-sm">
                  — {GAMES[selectedGame].displayName}
                </span>
              )}
            </h2>
            <button
              onClick={() => setSelectorRefreshKey((k) => k + 1)}
              className="text-xs text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-1"
              title="Re-fetch the sets list from the database"
            >
              ↻ Refresh
            </button>
          </div>
          <SetSelector
            selectedSetId={selectedSetId}
            onSetSelect={handleSetSelect}
            showImageStatus
            game={selectedGame ?? undefined}
            refreshKey={selectorRefreshKey}
          />
        </section>
      )}

      {/* ── Step 3: Choose upload type ─────────────────────────────────── */}
      {step === 3 && (
        <section>
          <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2 mb-4">
            <StepBadge n={3} active />
            What would you like to upload?
            {selectedSetName && (
              <span className="text-gray-400 font-normal text-sm">— {selectedSetName}</span>
            )}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <TypeCard
              icon="🗂️"
              label="Set Image"
              description="Upload the set's logo or banner image"
              onClick={() => handleTypeSelect('set')}
            />
            <TypeCard
              icon="🖼️"
              label="Card Images"
              description="Upload individual card images for this set"
              onClick={() => handleTypeSelect('card')}
            />
          </div>
        </section>
      )}

      {/* ── Card upload UI ─────────────────────────────────────────────── */}
      {step === 'card-upload' && selectedSetId && (
        <section className="space-y-8">
          {/* Card grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
                <StepBadge n={2} active={false} />
                Select a card
                {selectedSetName && (
                  <span className="text-gray-400 font-normal text-sm">— {selectedSetName}</span>
                )}
              </h2>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <CardImageGrid
                setId={selectedSetId}
                onCardSelect={handleCardSelect}
                onCardsLoaded={handleCardsLoaded}
                selectedCardId={selectedCard?.id}
                refreshKey={cardGridRefreshKey}
                imageOverrides={imageOverrides}
              />
            </div>
            <p className="mt-2 text-gray-500 text-xs">
              💡 Grey = no image stored. Click any card to open the upload dialog.
            </p>
          </div>

          {/* Bulk import — Pokémon only (pkmn.gg / dextcg are Pokémon-specific sources) */}
          {selectedGame === 'pokemon' ? (
            <div>
              <h2 className="text-base font-semibold mb-3 text-gray-200 flex items-center gap-2">
                <StepBadge n={3} active={false} />
                Bulk import from pkmn.gg
                <span className="text-gray-400 font-normal text-sm">
                  — paste a set or collection URL to import all card images at once
                </span>
              </h2>
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <BulkImageImport
                  setId={selectedSetId}
                  onComplete={() => setCardGridRefreshKey((k) => k + 1)}
                />
              </div>
            </div>
          ) : (
            <div className="p-5 bg-gray-900 border border-gray-700 rounded-xl">
              <h3 className="font-semibold text-yellow-400 mb-2">💡 Manual upload only</h3>
              <p className="text-gray-300 text-sm">
                Bulk import from external sources (pkmn.gg, dextcg) is only available for Pokémon.
                Click any grey card above to upload its image manually from a local file.
              </p>
            </div>
          )}

          {/* Card upload modal */}
          <CardImageUploadModal
            card={selectedCard}
            isOpen={cardModalOpen}
            onClose={() => setCardModalOpen(false)}
            onUploadSuccess={handleCardUploadSuccess}
            onNextCard={handleNextCard}
            hasNextCard={hasNextCard}
          />
        </section>
      )}

      {/* ── Set upload UI ──────────────────────────────────────────────── */}
      {step === 'set-upload' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm">
              Click a set to open the upload modal, then drag the logo from{' '}
              <a
                href="https://www.pkmn.gg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 hover:underline"
              >
                pkmn.gg
              </a>{' '}
              directly into the drop zone.
            </p>
            <button
              onClick={() => setSetGridRefreshKey((k) => k + 1)}
              className="ml-4 shrink-0 text-xs text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-1"
              title="Re-fetch the set list from the database"
            >
              ↻ Refresh sets
            </button>
          </div>

          <SetImageGrid
            onSetSelect={handleSetGridSelect}
            onSetsLoaded={setSetList}
            selectedSetId={selectedSet?.id ?? null}
            refreshKey={setGridRefreshKey}
            game={selectedGame ?? undefined}
          />

          <SetImageUploadModal
            set={selectedSet}
            isOpen={setModalOpen}
            onClose={() => setSetModalOpen(false)}
            onUploadSuccess={handleSetUploadSuccess}
            onNextSet={handleNextSet}
            hasNextSet={hasNextSet}
          />
        </section>
      )}
    </div>
  )
}
