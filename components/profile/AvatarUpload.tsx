'use client'

import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  /** Current avatar URL (or null for initials fallback) */
  currentUrl?: string | null
  /** Initials to display when no avatar is set */
  initials: string
  /** Called with the new public URL after a successful upload */
  onUploaded: (url: string) => void
  /** Whether the upload overlay is rendered (own profile / wizard) */
  editable?: boolean
  /** Size variant — 'lg' is the profile hero, 'md' is for the wizard */
  size?: 'md' | 'lg'
  className?: string
}

export default function AvatarUpload({
  currentUrl,
  initials,
  onUploaded,
  editable = false,
  size = 'lg',
  className,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  // When the R2 object is missing (404) the <img> fires onError.
  // Track that state so we gracefully fall back to initials instead of
  // showing a broken-image glyph.
  const [imgError, setImgError] = useState(false)

  const displayUrl = preview ?? currentUrl

  // Reset the error flag whenever the displayed URL changes (e.g. after a
  // successful upload sets a fresh preview URL).
  useEffect(() => { setImgError(false) }, [displayUrl])

  const sizeClasses = {
    md: 'w-20 h-20 text-xl',
    lg: 'w-24 h-24 text-2xl',
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Client-side pre-validation
    if (!file.type.startsWith('image/')) {
      setError('Must be an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2 MB')
      return
    }

    // Optimistic local preview
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        setPreview(null)
        return
      }

      onUploaded(json.avatarUrl)
    } catch {
      setError('Unexpected error during upload')
      setPreview(null)
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className={cn(
          'relative rounded-full shrink-0 overflow-hidden',
          'border-2 border-[rgba(109,95,255,0.4)]',
          'bg-accent-dim text-accent font-bold flex items-center justify-center',
          sizeClasses[size],
          editable && 'cursor-pointer group'
        )}
        onClick={() => editable && inputRef.current?.click()}
        role={editable ? 'button' : undefined}
        aria-label={editable ? 'Change avatar' : undefined}
      >
        {/* Avatar image — falls back to initials if the URL resolves to a 404 */}
        {(displayUrl && !imgError) ? (
          <img
            src={displayUrl}
            alt="Avatar"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontFamily: 'var(--font-space-grotesk)' }}>{initials}</span>
        )}

        {/* Upload overlay — shown on hover when editable */}
        {editable && (
          <div
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-1',
              'bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150',
              uploading && 'opacity-100'
            )}
          >
            {uploading ? (
              <svg
                className="w-5 h-5 text-white animate-spin"
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
            ) : (
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-[var(--danger)] text-center max-w-[10rem]">{error}</p>
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
