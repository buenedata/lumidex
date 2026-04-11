'use client'

import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface BannerUploadProps {
  /** Current banner URL (or null for gradient fallback) */
  currentUrl?: string | null
  /** Called with the new public URL after a successful upload */
  onUploaded: (url: string) => void
  /** Whether the upload overlay is rendered (own profile / wizard) */
  editable?: boolean
  /** 'hero' = tall full-width on profile page, 'compact' = shorter version in wizard */
  variant?: 'hero' | 'compact'
  className?: string
}

export default function BannerUpload({
  currentUrl,
  onUploaded,
  editable = false,
  variant = 'hero',
  className,
}: BannerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  // Gracefully fall back to the gradient when the R2 object is missing (404).
  const [imgError, setImgError] = useState(false)

  const displayUrl = preview ?? currentUrl

  useEffect(() => { setImgError(false) }, [displayUrl])

  const heightClass = variant === 'hero' ? 'h-48 md:h-56' : 'h-32'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Client-side pre-validation
    if (!file.type.startsWith('image/')) {
      setError('Must be an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB')
      return
    }

    // Optimistic local preview
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload-banner', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        setPreview(null)
        return
      }

      onUploaded(json.bannerUrl)
    } catch {
      setError('Unexpected error during upload')
      setPreview(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('relative w-full overflow-hidden rounded-xl', heightClass, className)}>
      {/* Banner image — falls back to gradient if the URL resolves to a 404 */}
      {(displayUrl && !imgError) ? (
        <img
          src={displayUrl}
          alt="Profile banner"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,95,255,0.55), transparent)',
          }}
        />
      )}

      {/* Scrim for readability — only when the image is actually visible */}
      {(displayUrl && !imgError) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      )}

      {/* Upload overlay — shown on hover when editable */}
      {editable && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'absolute inset-0 w-full flex flex-col items-center justify-center gap-2',
            'opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150',
            'bg-black/50 cursor-pointer',
            uploading && 'opacity-100 cursor-not-allowed'
          )}
          aria-label="Change banner image"
        >
          {uploading ? (
            <>
              <svg
                className="w-6 h-6 text-white animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-white text-sm font-medium">Uploading…</span>
            </>
          ) : (
            <>
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-white text-sm font-medium">Change Banner</span>
              <span className="text-white/60 text-xs">JPEG, PNG, WebP or GIF · max 5 MB</span>
            </>
          )}
        </button>
      )}

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-[var(--danger-muted)] border border-[var(--danger)] text-[var(--danger)] text-xs whitespace-nowrap">
          {error}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
    </div>
  )
}
