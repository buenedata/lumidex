'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { uploadCardImage } from '@/lib/imageUpload'
import type { CardGridItem } from './CardImageGrid'

interface UploadState {
  uploading: boolean
  success: boolean
  error: string | null
  imageUrl: string | null
}

interface VariantRow {
  id: string
  name: string
  color: string
  variant_image_url: string | null
}

interface Props {
  card: CardGridItem | null
  isOpen: boolean
  onClose: () => void
  onUploadSuccess: (cardId: string, imageUrl: string) => void
  onNextCard?: () => void
  hasNextCard?: boolean
}

// Domains accepted for URL-paste import (mirrors proxy-image allow-list)
const ACCEPTED_URL_HOSTS = [
  'static.tcgcollector.com',
  'tcgcollector.com',
  'www.tcgcollector.com',
  'assets.pkmn.gg',
  'pkmn.gg',
  'www.pkmn.gg',
  'site.pkmn.gg',
  // dext TCG
  'dextcg.com',
  'www.dextcg.com',
  'app.dextcg.com',
  'cdn.dextcg.com',
  // Other trusted sources
  'public.getcollectr.com',
  'limitlesstcg.com',
  'www.limitlesstcg.com',
]

const COLOR_HEX: Record<string, string> = {
  green:  '#10b981',
  blue:   '#3b82f6',
  purple: '#8b5cf6',
  red:    '#ef4444',
  pink:   '#ec4899',
  yellow: '#eab308',
  gray:   '#6b7280',
  orange: '#f97316',
  teal:   '#14b8a6',
}

/**
 * Fetch an external image URL via the server-side proxy (avoids CORS).
 */
async function fetchImageViaProxy(imageUrl: string): Promise<File> {
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
  const response = await fetch(proxyUrl)

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Proxy fetch failed: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const blob = await response.blob()
  const urlPath = new URL(imageUrl).pathname
  const fileName = urlPath.split('/').pop() || 'card-image.jpg'
  return new File([blob], fileName, { type: contentType })
}

/**
 * Return true if the URL string is a valid https URL from an accepted image host.
 */
function isAcceptedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' && ACCEPTED_URL_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

type ActiveTab = 'card' | 'variants'

export function CardImageUploadModal({ card, isOpen, onClose, onUploadSuccess, onNextCard, hasNextCard }: Props) {
  // ── Shared upload-zone state ─────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlPreviewSrc, setUrlPreviewSrc] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    success: false,
    error: null,
    imageUrl: null,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('card')

  // ── Variant images state ─────────────────────────────────────────────────
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  // Fetch variants (with their current hover images) when tab switches to 'variants'
  const fetchVariants = useCallback(async (cardId: string) => {
    setLoadingVariants(true)
    try {
      const res = await fetch(`/api/variants?cardId=${cardId}`)
      if (!res.ok) return
      const data: VariantRow[] = await res.json()
      setVariants(data)
    } catch { /* non-critical */ } finally {
      setLoadingVariants(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'variants' && card?.id) {
      fetchVariants(card.id)
    }
  }, [activeTab, card?.id, fetchVariants])

  // Reset all state
  const reset = () => {
    setSelectedFile(null)
    setDragOver(false)
    setFetchingUrl(false)
    setUrlInput('')
    setUrlPreviewSrc(null)
    setUploadState({ uploading: false, success: false, error: null, imageUrl: null })
  }

  // Reset DnD zone only (used when selecting a different variant)
  const resetZone = () => {
    setSelectedFile(null)
    setUrlPreviewSrc(null)
    setUploadState({ uploading: false, success: false, error: null, imageUrl: null })
  }

  const handleClose = () => {
    reset()
    setActiveTab('card')
    setSelectedVariantId(null)
    setVariants([])
    onClose()
  }

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadState((prev) => ({ ...prev, error: 'Please select an image file' }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadState((prev) => ({ ...prev, error: 'Image must be smaller than 5 MB' }))
      return
    }
    setSelectedFile(file)
    setUrlPreviewSrc(null)
    setUrlInput('')
    setUploadState({ uploading: false, success: false, error: null, imageUrl: null })
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const items = Array.from(e.dataTransfer.items)
    const uriItem =
      items.find((i) => i.kind === 'string' && i.type === 'text/uri-list') ||
      items.find((i) => i.kind === 'string' && i.type === 'text/plain')

    if (uriItem) {
      uriItem.getAsString(async (rawText) => {
        const imageUrl = rawText
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.startsWith('https://'))

        if (!imageUrl) {
          setUploadState((prev) => ({
            ...prev,
            error: 'Could not detect an https image URL from the drag. Try using "Browse Files" instead.',
          }))
          return
        }

        setFetchingUrl(true)
        setUploadState({ uploading: false, success: false, error: null, imageUrl: null })

        try {
          const file = await fetchImageViaProxy(imageUrl)
          setFetchingUrl(false)
          handleFileSelect(file)
        } catch (err) {
          setFetchingUrl(false)
          setUploadState((prev) => ({
            ...prev,
            error: `URL fetch failed: ${err instanceof Error ? err.message : err}`,
          }))
        }
      })
      return
    }

    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  /** Load an image from the URL input via proxy, populating selectedFile for normal upload. */
  const handleLoadFromUrl = async () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return

    if (!isAcceptedImageUrl(trimmed)) {
      setUploadState((prev) => ({
        ...prev,
        error: 'URL must be an https image from TCGCollector, pkmn.gg, or dext TCG',
      }))
      return
    }

    setFetchingUrl(true)
    setUploadState({ uploading: false, success: false, error: null, imageUrl: null })

    try {
      const file = await fetchImageViaProxy(trimmed)
      setFetchingUrl(false)
      const objectUrl = URL.createObjectURL(file)
      handleFileSelect(file)
      setUrlPreviewSrc(objectUrl)
    } catch (err) {
      setFetchingUrl(false)
      setUploadState((prev) => ({
        ...prev,
        error: `URL fetch failed: ${err instanceof Error ? err.message : err}`,
      }))
    }
  }

  /** Upload the base card image (existing behaviour). */
  const handleCardUpload = async () => {
    if (!card || !selectedFile) return

    setUploadState({ uploading: true, success: false, error: null, imageUrl: null })

    const pokemonCard = {
      id: card.id,
      set_id: card.set_id,
      name: card.name,
      number: card.number,
      rarity: card.rarity,
      type: null,
      image: card.image,
      created_at: new Date().toISOString(),
    }

    const result = await uploadCardImage(pokemonCard, selectedFile)

    if (result.success && result.imageUrl) {
      setUploadState({ uploading: false, success: true, error: null, imageUrl: result.imageUrl })
      onUploadSuccess(card.id, result.imageUrl)
    } else {
      setUploadState({
        uploading: false,
        success: false,
        error: result.error || 'Upload failed',
        imageUrl: null,
      })
    }
  }

  /** Upload a variant-specific hover image (new behaviour). */
  const handleVariantUpload = async () => {
    if (!card || !selectedFile || !selectedVariantId) return

    setUploadState({ uploading: true, success: false, error: null, imageUrl: null })

    const fd = new FormData()
    fd.append('file', selectedFile)
    fd.append('cardId', card.id)
    fd.append('variantId', selectedVariantId)

    try {
      const res = await fetch('/api/upload-variant-image', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const { imageUrl } = await res.json()
      setUploadState({ uploading: false, success: true, error: null, imageUrl })
      // Patch local variant list so the thumbnail updates immediately
      setVariants(prev =>
        prev.map(v => v.id === selectedVariantId ? { ...v, variant_image_url: imageUrl } : v)
      )
    } catch (err: any) {
      setUploadState({
        uploading: false,
        success: false,
        error: err.message || 'Upload failed',
        imageUrl: null,
      })
    }
  }

  /** Remove a variant hover image. */
  const handleVariantRemove = async (variantId: string) => {
    if (!card) return
    if (!confirm('Remove hover image for this variant?')) return
    try {
      const res = await fetch(
        `/api/upload-variant-image?cardId=${card.id}&variantId=${variantId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Remove failed')
      }
      setVariants(prev =>
        prev.map(v => v.id === variantId ? { ...v, variant_image_url: null } : v)
      )
    } catch (err: any) {
      setUploadState(prev => ({ ...prev, error: err.message || 'Remove failed' }))
    }
  }

  const handleUpload = activeTab === 'card' ? handleCardUpload : handleVariantUpload

  const dropZoneBorderClass = dragOver
    ? 'border-yellow-400 bg-yellow-400/5'
    : selectedFile
    ? 'border-green-500 bg-green-500/5'
    : fetchingUrl
    ? 'border-blue-400 bg-blue-400/5'
    : 'border-gray-600'

  const urlInputValid = isAcceptedImageUrl(urlInput)

  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? null

  return (
    <Transition show={isOpen}>
      <Dialog onClose={handleClose} className="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
        </TransitionChild>

        {/* Modal panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-white">
                    Upload Card Image
                  </DialogTitle>
                  {card && (
                    <p className="text-gray-400 text-sm mt-0.5">
                      {card.name}
                      <span className="text-gray-600 ml-1">
                        #{card.number}
                        {card.rarity && ` · ${card.rarity}`}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-500 hover:text-white transition-colors text-xl leading-none ml-4 mt-0.5"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* ── Tab bar ──────────────────────────────────────────────── */}
              <div className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-800">
                <button
                  onClick={() => { setActiveTab('card'); reset() }}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === 'card'
                      ? 'bg-gray-700 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  📸 Card Image
                </button>
                <button
                  onClick={() => { setActiveTab('variants'); reset(); setSelectedVariantId(null) }}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === 'variants'
                      ? 'bg-gray-700 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  🎨 Variant Images
                </button>
              </div>

              {/* ════════════════════════════════════════════════════════════
                  TAB: Card Image (existing behaviour)
              ════════════════════════════════════════════════════════════ */}
              {activeTab === 'card' && (
                <>
                  {/* Current image preview (own upload or inherited source) */}
                  {!uploadState.success && (card?.image || card?.source_image) && (
                    <div className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800">
                      <img
                        src={(card.image ?? card.source_image)!}
                        alt={card.name}
                        className="w-12 h-auto rounded"
                      />
                      {card.image ? (
                        <p className="text-green-400 text-sm">✅ Card already has an image — uploading will replace it</p>
                      ) : (
                        <p className="text-teal-400 text-sm">🔗 Using inherited image from source card — uploading will add a card-specific image</p>
                      )}
                    </div>
                  )}

                  {/* Success state */}
                  {uploadState.success ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                        <p className="text-green-400 font-semibold text-lg">✅ Image uploaded!</p>
                        {uploadState.imageUrl && (
                          <div className="mt-3 flex justify-center">
                            <img
                              src={uploadState.imageUrl}
                              alt="Uploaded card"
                              className="h-32 w-auto rounded shadow-lg"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={reset}
                          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                        >
                          Upload another
                        </button>
                        {hasNextCard && onNextCard && (
                          <button
                            onClick={() => { reset(); onNextCard() }}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
                          >
                            Next Card →
                          </button>
                        )}
                        <button
                          onClick={handleClose}
                          className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-lg transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ── Drop zone ─────────────────────────────────────── */}
                      <DropZone
                        dragOver={dragOver}
                        dropZoneBorderClass={dropZoneBorderClass}
                        fetchingUrl={fetchingUrl}
                        selectedFile={selectedFile}
                        urlPreviewSrc={urlPreviewSrc}
                        fileInputRef={fileInputRef}
                        onDrop={handleDrop}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
                        onClick={() => !selectedFile && !fetchingUrl && fileInputRef.current?.click()}
                        onRemoveFile={() => {
                          setSelectedFile(null)
                          setUrlPreviewSrc(null)
                          setUploadState({ uploading: false, success: false, error: null, imageUrl: null })
                        }}
                        onFileChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileSelect(file)
                        }}
                      />

                      {/* ── URL paste ──────────────────────────────────────── */}
                      <UrlPasteSection
                        urlInput={urlInput}
                        urlInputValid={urlInputValid}
                        fetchingUrl={fetchingUrl}
                        uploading={uploadState.uploading}
                        error={uploadState.error}
                        onUrlChange={(v) => {
                          setUrlInput(v)
                          if (uploadState.error) setUploadState(p => ({ ...p, error: null }))
                        }}
                        onLoad={handleLoadFromUrl}
                      />

                      {/* ── Error ─────────────────────────────────────────── */}
                      {uploadState.error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-red-400 text-sm">❌ {uploadState.error}</p>
                        </div>
                      )}

                      {/* ── Actions ───────────────────────────────────────── */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleClose}
                          className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleUpload}
                          disabled={!selectedFile || uploadState.uploading}
                          className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition-colors"
                        >
                          {uploadState.uploading ? 'Uploading…' : 'Upload & Save'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ════════════════════════════════════════════════════════════
                  TAB: Variant Images (new)
              ════════════════════════════════════════════════════════════ */}
              {activeTab === 'variants' && (
                <>
                  <p className="text-xs text-gray-500 -mt-2">
                    Upload a hover image per variant. When a collector hovers that variant row in the card modal, the card image will cross-fade to this image.
                  </p>

                  {/* Variant list ─────────────────────────────────────── */}
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {loadingVariants ? (
                      <div className="text-gray-500 text-sm py-3 text-center animate-pulse">Loading variants…</div>
                    ) : variants.length === 0 ? (
                      <div className="text-gray-600 text-sm py-3 text-center">No variants found for this card</div>
                    ) : (
                      variants.map(v => (
                        <div
                          key={v.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                            selectedVariantId === v.id
                              ? 'bg-yellow-500/10 border-yellow-500/50'
                              : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                          }`}
                          onClick={() => {
                            setSelectedVariantId(v.id)
                            resetZone()
                          }}
                        >
                          {/* Colour dot */}
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: COLOR_HEX[v.color] ?? '#6b7280' }}
                          />
                          {/* Name */}
                          <span className="text-sm text-white font-medium flex-1 truncate">{v.name}</span>
                          {/* Current thumbnail */}
                          {v.variant_image_url ? (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <img
                                src={v.variant_image_url}
                                alt=""
                                className="w-6 h-8 object-cover rounded border border-gray-700"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleVariantRemove(v.id) }}
                                className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
                                title="Remove hover image"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs flex-shrink-0">no image</span>
                          )}
                          {selectedVariantId === v.id && (
                            <span className="text-yellow-400 text-[10px] flex-shrink-0">selected</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Drop zone + actions (only when a variant is selected) */}
                  {selectedVariantId && selectedVariant && (
                    <>
                      <p className="text-xs text-gray-400 text-center -mt-1">
                        Uploading hover image for:{' '}
                        <span className="font-semibold" style={{ color: COLOR_HEX[selectedVariant.color] ?? '#fff' }}>
                          {selectedVariant.name}
                        </span>
                      </p>

                      {/* Success state */}
                      {uploadState.success ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                            <p className="text-green-400 font-semibold">✅ Hover image saved!</p>
                            {uploadState.imageUrl && (
                              <div className="mt-2 flex justify-center">
                                <img src={uploadState.imageUrl} alt="Uploaded" className="h-24 w-auto rounded shadow-lg" />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={resetZone}
                              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                            >
                              Upload another variant
                            </button>
                            <button
                              onClick={handleClose}
                              className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-lg transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <DropZone
                            dragOver={dragOver}
                            dropZoneBorderClass={dropZoneBorderClass}
                            fetchingUrl={fetchingUrl}
                            selectedFile={selectedFile}
                            urlPreviewSrc={urlPreviewSrc}
                            fileInputRef={fileInputRef}
                            onDrop={handleDrop}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
                            onClick={() => !selectedFile && !fetchingUrl && fileInputRef.current?.click()}
                            onRemoveFile={() => {
                              setSelectedFile(null)
                              setUrlPreviewSrc(null)
                              setUploadState({ uploading: false, success: false, error: null, imageUrl: null })
                            }}
                            onFileChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileSelect(file)
                            }}
                          />

                          <UrlPasteSection
                            urlInput={urlInput}
                            urlInputValid={urlInputValid}
                            fetchingUrl={fetchingUrl}
                            uploading={uploadState.uploading}
                            error={uploadState.error}
                            onUrlChange={(v) => {
                              setUrlInput(v)
                              if (uploadState.error) setUploadState(p => ({ ...p, error: null }))
                            }}
                            onLoad={handleLoadFromUrl}
                          />

                          {uploadState.error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                              <p className="text-red-400 text-sm">❌ {uploadState.error}</p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={handleClose}
                              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleUpload}
                              disabled={!selectedFile || uploadState.uploading}
                              className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-semibold text-sm rounded-lg transition-colors"
                            >
                              {uploadState.uploading ? 'Uploading…' : `Upload for ${selectedVariant.name}`}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Prompt when no variant selected */}
                  {!selectedVariantId && !loadingVariants && variants.length > 0 && (
                    <p className="text-gray-600 text-xs text-center">
                      ↑ Click a variant above to upload its hover image
                    </p>
                  )}
                </>
              )}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface DropZoneProps {
  dragOver: boolean
  dropZoneBorderClass: string
  fetchingUrl: boolean
  selectedFile: File | null
  urlPreviewSrc: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onClick: () => void
  onRemoveFile: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function DropZone({
  dropZoneBorderClass, fetchingUrl, selectedFile, urlPreviewSrc,
  fileInputRef, onDrop, onDragOver, onDragLeave, onClick, onRemoveFile, onFileChange,
}: DropZoneProps) {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-150 cursor-pointer ${dropZoneBorderClass}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={onClick}
    >
      {fetchingUrl ? (
        <div>
          <p className="text-blue-400 font-semibold animate-pulse">⏳ Fetching image…</p>
          <p className="text-gray-500 text-sm mt-1">Proxying through server to bypass CORS</p>
        </div>
      ) : selectedFile ? (
        <div>
          {urlPreviewSrc && (
            <div className="flex justify-center mb-3">
              <img src={urlPreviewSrc} alt="Preview" className="h-28 w-auto rounded shadow-md" />
            </div>
          )}
          <p className="text-green-400 font-semibold">✅ {selectedFile.name}</p>
          <p className="text-gray-400 text-sm mt-1">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            {selectedFile.type === 'image/webp' && <span className="ml-2 text-gray-500">(WebP)</span>}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveFile() }}
            className="mt-2 text-xs text-gray-500 hover:text-red-400 transition-colors underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="space-y-1 pointer-events-none">
          <p className="text-2xl">📸</p>
          <p className="text-white font-medium">
            Drag image from{' '}
            <span className="text-yellow-400">TCGCollector</span>
            {', '}
            <span className="text-yellow-400">pkmn.gg</span>
            {', or '}
            <span className="text-yellow-400">dext TCG</span>
          </p>
          <p className="text-gray-500 text-sm">or click to browse files</p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  )
}

interface UrlPasteSectionProps {
  urlInput: string
  urlInputValid: boolean
  fetchingUrl: boolean
  uploading: boolean
  error: string | null
  onUrlChange: (v: string) => void
  onLoad: () => void
}

function UrlPasteSection({ urlInput, urlInputValid, fetchingUrl, uploading, onUrlChange, onLoad }: UrlPasteSectionProps) {
  return (
    <div>
      <p className="text-xs text-gray-500 text-center mb-2">— or paste an image URL —</p>
      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && urlInputValid && !fetchingUrl) onLoad() }}
          placeholder="https://static.tcgcollector.com/…  or  https://assets.pkmn.gg/…  or  https://app.dextcg.com/…"
          disabled={fetchingUrl || uploading}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-500 disabled:opacity-50"
        />
        <button
          onClick={onLoad}
          disabled={!urlInputValid || fetchingUrl || uploading}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors whitespace-nowrap"
        >
          {fetchingUrl ? '⏳' : 'Load'}
        </button>
      </div>
      {urlInput.length > 8 && !urlInputValid && (
        <p className="text-yellow-600 text-xs mt-1">
          ⚠️ Must be an https URL from TCGCollector, pkmn.gg, or dext TCG
        </p>
      )}
    </div>
  )
}
