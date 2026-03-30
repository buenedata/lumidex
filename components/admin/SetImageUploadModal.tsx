'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import type { SetGridItem } from './SetImageGrid'

interface UploadState {
  uploading: boolean
  success: boolean
  error: string | null
  logoUrl: string | null
}

interface Props {
  set: SetGridItem | null
  isOpen: boolean
  onClose: () => void
  onUploadSuccess: (setId: string, logoUrl: string) => void
  onNextSet?: () => void
  hasNextSet?: boolean
}

/**
 * Fetch an external image URL via the server-side proxy (avoids CORS).
 * Reuses the same /api/proxy-image route used for card images.
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
  const fileName = urlPath.split('/').pop() || 'set-logo.jpg'
  return new File([blob], fileName, { type: contentType })
}

export function SetImageUploadModal({ set, isOpen, onClose, onUploadSuccess, onNextSet, hasNextSet }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    success: false,
    error: null,
    logoUrl: null,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setSelectedFile(null)
    setDragOver(false)
    setFetchingUrl(false)
    setUploadState({ uploading: false, success: false, error: null, logoUrl: null })
  }

  const handleClose = () => {
    reset()
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
    setUploadState({ uploading: false, success: false, error: null, logoUrl: null })
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
        setUploadState({ uploading: false, success: false, error: null, logoUrl: null })

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

    // Fallback: native file drop
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!set || !selectedFile) return

    setUploadState({ uploading: true, success: false, error: null, logoUrl: null })

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('setId', set.id)

      const response = await fetch('/api/upload-set-image', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Upload failed (HTTP ${response.status})`)
      }

      setUploadState({ uploading: false, success: true, error: null, logoUrl: result.logoUrl })
      onUploadSuccess(set.id, result.logoUrl)
    } catch (err) {
      setUploadState({
        uploading: false,
        success: false,
        error: err instanceof Error ? err.message : 'Upload failed',
        logoUrl: null,
      })
    }
  }

  const dropZoneBorderClass = dragOver
    ? 'border-yellow-400 bg-yellow-400/5'
    : selectedFile
    ? 'border-green-500 bg-green-500/5'
    : fetchingUrl
    ? 'border-blue-400 bg-blue-400/5'
    : 'border-gray-600'

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
                    Upload Set Logo
                  </DialogTitle>
                  {set && (
                    <p className="text-gray-400 text-sm mt-0.5">
                      {set.name}
                      {set.series && (
                        <span className="text-gray-600 ml-1">· {set.series}</span>
                      )}
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

              {/* Current logo preview (if any) */}
              {set?.logo_url && !uploadState.success && (
                <div className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800">
                  <img
                    src={set.logo_url}
                    alt={set.name}
                    className="h-10 w-auto rounded"
                  />
                  <p className="text-green-400 text-sm">✅ Set already has a logo — uploading will replace it</p>
                </div>
              )}

              {/* Success state */}
              {uploadState.success ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                    <p className="text-green-400 font-semibold text-lg">✅ Logo uploaded!</p>
                    {uploadState.logoUrl && (
                      <div className="mt-3 flex justify-center">
                        <img
                          src={uploadState.logoUrl}
                          alt="Uploaded logo"
                          className="h-20 w-auto rounded shadow-lg"
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
                    {hasNextSet && onNextSet && (
                      <button
                        onClick={() => { reset(); onNextSet() }}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Next Set →
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
                  {/* Drop zone */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-150 cursor-pointer ${dropZoneBorderClass}`}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
                    onClick={() => !selectedFile && !fetchingUrl && fileInputRef.current?.click()}
                  >
                    {fetchingUrl ? (
                      <div>
                        <p className="text-blue-400 font-semibold animate-pulse">⏳ Fetching image from URL…</p>
                        <p className="text-gray-500 text-sm mt-1">Proxying through server to bypass CORS</p>
                      </div>
                    ) : selectedFile ? (
                      <div>
                        <p className="text-green-400 font-semibold">✅ {selectedFile.name}</p>
                        <p className="text-gray-400 text-sm mt-1">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedFile(null)
                            setUploadState({ uploading: false, success: false, error: null, logoUrl: null })
                          }}
                          className="mt-2 text-xs text-gray-500 hover:text-red-400 transition-colors underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 pointer-events-none">
                        <p className="text-2xl">🏷️</p>
                        <p className="text-white font-medium">
                          Drag set logo from{' '}
                          <span className="text-yellow-400">pkmn.gg</span>
                          {' '}or your desktop
                        </p>
                        <p className="text-gray-500 text-sm">or click to browse files</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelect(file)
                      }}
                    />
                  </div>

                  {/* Error */}
                  {uploadState.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">❌ {uploadState.error}</p>
                    </div>
                  )}

                  {/* Actions */}
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
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
