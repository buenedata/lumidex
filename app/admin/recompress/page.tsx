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

type DeletePhase = 'idle' | 'listing' | 'deleting' | 'db' | 'done' | 'error'

export default function RecompressPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  // ── empty-bucket state ───────────────────────────────────────────────────
  const [deleteBucket, setDeleteBucket] = useState<Bucket>('card-images')
  const [clearDb, setClearDb]           = useState(true)
  const [confirmText, setConfirmText]   = useState('')
  const [phase, setPhase]               = useState<DeletePhase>('idle')
  const [total, setTotal]               = useState(0)
  const [deleted, setDeleted]           = useState(0)
  const [dbCleared, setDbCleared]       = useState(0)
  const [errorMsg, setErrorMsg]         = useState<string | null>(null)

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

  const canDelete  = confirmText === 'DELETE'
  const isRunning  = phase === 'listing' || phase === 'deleting' || phase === 'db'
  const progressPct = total > 0 ? Math.round((deleted / total) * 100) : 0

  const handleEmptyBucket = async () => {
    if (!canDelete || isRunning) return

    setPhase('listing')
    setTotal(0)
    setDeleted(0)
    setDbCleared(0)
    setErrorMsg(null)

    const res = await fetch('/api/admin/empty-bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: deleteBucket, clearDbUrls: clearDb }),
    })

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => 'Unknown error')
      setErrorMsg(`Request failed (${res.status}): ${text}`)
      setPhase('error')
      return
    }

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buf       = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let ev: { type: string; payload: Record<string, number> }
        try { ev = JSON.parse(line.slice(6)) } catch { continue }

        if (ev.type === 'start') {
          setTotal(ev.payload.total)
          setPhase('deleting')
        } else if (ev.type === 'progress') {
          setDeleted(ev.payload.deleted)
          setTotal(ev.payload.total)
        } else if (ev.type === 'complete') {
          setDeleted(ev.payload.deleted)
          setDbCleared(ev.payload.dbRowsCleared)
          setPhase('done')
          setConfirmText('')
        } else if (ev.type === 'error') {
          setErrorMsg((ev.payload as unknown as { message: string }).message)
          setPhase('error')
        }
      }
    }

    // If stream ended without a complete event (edge-case), still mark done
    setPhase((p) => (p === 'deleting' || p === 'db' ? 'done' : p))
  }

  const handleReset = () => {
    setPhase('idle')
    setTotal(0)
    setDeleted(0)
    setDbCleared(0)
    setErrorMsg(null)
    setConfirmText('')
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

            {/* ── Success result ── */}
            {phase === 'done' && (
              <div className="p-3 bg-green-950 border border-green-700 rounded-lg text-green-300 text-sm space-y-1">
                <p className="font-semibold text-green-400">✅ Bucket emptied</p>
                <p>
                  Deleted <strong>{deleted}</strong> file{deleted !== 1 ? 's' : ''} from storage.
                  {dbCleared > 0 && (
                    <> Also cleared image URLs on{' '}
                    <strong>{dbCleared}</strong> database row{dbCleared !== 1 ? 's' : ''}.</>
                  )}
                </p>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-400 underline hover:text-white transition-colors"
                >
                  Empty another bucket
                </button>
              </div>
            )}

            {/* ── Error ── */}
            {phase === 'error' && errorMsg && (
              <div className="p-3 bg-red-950 border border-red-700 rounded-lg text-red-300 text-sm space-y-2">
                <p>⚠️ {errorMsg}</p>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-400 underline hover:text-white transition-colors"
                >
                  Try again
                </button>
              </div>
            )}

            {/* ── Progress ── */}
            {(phase === 'listing' || phase === 'deleting' || phase === 'db') && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>
                    {phase === 'listing'  && '🔍 Listing files…'}
                    {phase === 'deleting' && `Deleting ${deleted} / ${total} files…`}
                    {phase === 'db'       && 'Clearing database image URLs…'}
                  </span>
                  {phase === 'deleting' && total > 0 && (
                    <span>{progressPct} %</span>
                  )}
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full transition-all duration-200 bg-red-500"
                    style={{ width: phase === 'listing' ? '5%' : `${Math.max(progressPct, 5)}%` }}
                  />
                </div>
                {phase === 'deleting' && total > 0 && (
                  <p className="text-xs text-gray-500 text-right">
                    {deleted.toLocaleString()} / {total.toLocaleString()} files deleted
                  </p>
                )}
              </div>
            )}

            {/* ── Controls (hidden while running or done) ── */}
            {(phase === 'idle' || phase === 'error') && (
              <>
                {/* Bucket selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Bucket to empty
                  </label>
                  <select
                    value={deleteBucket}
                    onChange={(e) => setDeleteBucket(e.target.value as Bucket)}
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
                    placeholder="DELETE"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                  />
                </div>

                {/* Delete button */}
                <button
                  onClick={handleEmptyBucket}
                  disabled={!canDelete}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    canDelete
                      ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  🗑️ Empty {BUCKET_LABELS[deleteBucket]}
                </button>
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
