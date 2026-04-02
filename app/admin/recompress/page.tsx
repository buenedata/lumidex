'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { RecompressImages } from '../../../components/admin/RecompressImages'

type Bucket = 'card-images' | 'product-images' | 'set-images'

const BUCKET_LABELS: Record<Bucket, string> = {
  'card-images':    'Card Images',
  'product-images': 'Product Images',
  'set-images':     'Set Images',
}

export default function RecompressPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  // ── empty-bucket state ───────────────────────────────────────────────────
  const [deleteBucket, setDeleteBucket]     = useState<Bucket>('card-images')
  const [clearDb, setClearDb]               = useState(true)
  const [confirmText, setConfirmText]       = useState('')
  const [isDeleting, setIsDeleting]         = useState(false)
  const [deleteResult, setDeleteResult]     = useState<{ deleted: number; dbRowsCleared: number } | null>(null)
  const [deleteError, setDeleteError]       = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin/recompress')
        return
      }
      if (profile?.role !== 'admin') {
        router.push('/dashboard?error=admin_required')
      }
    }
  }, [user, profile, isLoading, router])

  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  const canDelete = confirmText === 'DELETE'

  const handleEmptyBucket = async () => {
    if (!canDelete) return
    setIsDeleting(true)
    setDeleteResult(null)
    setDeleteError(null)

    try {
      const res = await fetch('/api/admin/empty-bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: deleteBucket, clearDbUrls: clearDb }),
      })
      const json = await res.json()
      if (!res.ok) {
        setDeleteError(json.error ?? `Request failed (${res.status})`)
      } else {
        setDeleteResult(json)
        setConfirmText('')
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link href="/admin" className="hover:text-yellow-400 transition-colors">
              🛠️ Admin
            </Link>
            <span>/</span>
            <span className="text-white">Storage Management</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🗜️ Storage Management
          </h1>
          <p className="text-gray-400 mt-1">
            Recompress existing images to WebP, or empty a bucket and re-import set by set.
          </p>
        </div>

        {/* ── Recompress section ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-1 text-gray-200">Recompress existing images</h2>
          <p className="text-gray-400 text-sm mb-4">
            Downloads every image, compresses to{' '}
            <strong className="text-white">WebP 82 % / 500 px max</strong> and re-uploads
            in-place. Files that are already smaller are skipped.
            Expect <strong className="text-yellow-400">85–90 % size reduction</strong> vs raw PNG.
          </p>
          <div className="p-5 bg-gray-900 border border-gray-800 rounded-xl">
            <RecompressImages defaultBucket="card-images" />
          </div>
        </section>

        {/* ── Danger Zone ────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-1 text-red-400">⚠️ Danger Zone — Empty Bucket</h2>
          <p className="text-gray-400 text-sm mb-4">
            Permanently deletes <strong className="text-white">all files</strong> in the
            selected storage bucket and (optionally) clears the matching image column in the
            database so cards show as needing re-upload. Use this to wipe old uncompressed
            images and re-import set by set using the Bulk Import tool.
          </p>

          <div className="p-5 bg-gray-950 border border-red-900 rounded-xl space-y-4">

            {/* Success result */}
            {deleteResult && (
              <div className="p-3 bg-green-950 border border-green-700 rounded-lg text-green-300 text-sm">
                ✅ Deleted <strong>{deleteResult.deleted}</strong> file
                {deleteResult.deleted !== 1 ? 's' : ''} from storage.
                {deleteResult.dbRowsCleared > 0 && (
                  <> Cleared image URLs on <strong>{deleteResult.dbRowsCleared}</strong> database row
                  {deleteResult.dbRowsCleared !== 1 ? 's' : ''}.</>
                )}
              </div>
            )}

            {/* Error */}
            {deleteError && (
              <div className="p-3 bg-red-950 border border-red-700 rounded-lg text-red-300 text-sm">
                ⚠️ {deleteError}
              </div>
            )}

            {/* Bucket selector */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Bucket to empty
              </label>
              <select
                value={deleteBucket}
                onChange={(e) => { setDeleteBucket(e.target.value as Bucket); setDeleteResult(null) }}
                disabled={isDeleting}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                {(Object.entries(BUCKET_LABELS) as [Bucket, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Clear DB toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={clearDb}
                onChange={(e) => setClearDb(e.target.checked)}
                disabled={isDeleting}
                className="w-4 h-4 rounded accent-red-500"
              />
              <span className="text-sm text-gray-300">
                Also clear image URLs in the database
                <span className="block text-xs text-gray-500">
                  Recommended — cards will show as grey (no image) in the upload grid
                </span>
              </span>
            </label>

            {/* Confirmation input */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Type <strong className="text-red-400">DELETE</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isDeleting}
                placeholder="DELETE"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Delete button */}
            <button
              onClick={handleEmptyBucket}
              disabled={!canDelete || isDeleting}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                canDelete && !isDeleting
                  ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {isDeleting
                ? '⏳ Deleting…'
                : `🗑️ Empty ${BUCKET_LABELS[deleteBucket]}`}
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
