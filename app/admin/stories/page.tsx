'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

interface StorySummary {
  id:           string
  slug:         string
  category:     string
  category_icon: string
  title:        string
  gradient:     string
  published_at: string
  created_at:   string
}

export default function AdminStoriesPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [stories,  setStories]  = useState<StorySummary[]>([])
  const [fetching, setFetching] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user)                    router.push('/login?redirect=/admin/stories')
      else if (profile?.role !== 'admin') router.push('/dashboard?error=admin_required')
    }
  }, [user, profile, isLoading, router])

  // ── Fetch stories ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || profile?.role !== 'admin') return
    fetch('/api/admin/stories')
      .then(r => r.json())
      .then(j => { setStories(j.stories ?? []); setFetchErr(null) })
      .catch(() => setFetchErr('Failed to load stories'))
      .finally(() => setFetching(false))
  }, [user, profile])

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/stories/${id}`, { method: 'DELETE' })
      if (res.ok) setStories(prev => prev.filter(s => s.id !== id))
      else alert('Failed to delete story')
    } catch {
      alert('Network error')
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            ← Admin Panel
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <span>📰</span> Stories CMS
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Create, edit and delete news articles. All saves publish immediately.
              </p>
            </div>
            <Link
              href="/admin/stories/new"
              className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold
                         text-sm rounded-xl transition-colors shrink-0"
            >
              + New Story
            </Link>
          </div>
        </div>

        {/* Content */}
        {fetching ? (
          <div className="text-gray-500 text-sm animate-pulse py-12 text-center">Loading stories…</div>
        ) : fetchErr ? (
          <div className="text-red-400 text-sm py-12 text-center">{fetchErr}</div>
        ) : stories.length === 0 ? (
          <div className="text-gray-500 text-sm py-12 text-center border border-dashed border-gray-700 rounded-xl">
            No stories yet.{' '}
            <Link href="/admin/stories/new" className="text-yellow-400 hover:text-yellow-300 underline">
              Create the first one
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map(story => (
              <div
                key={story.id}
                className="flex items-center gap-4 bg-gray-900 border border-gray-700 rounded-xl p-4
                           hover:border-gray-500 transition-colors"
              >
                {/* Gradient swatch */}
                <div
                  className="w-10 h-10 rounded-lg shrink-0 border border-white/10"
                  style={{ background: story.gradient }}
                />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-600">
                      {story.category_icon} {story.category}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(story.published_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-white font-medium text-sm mt-1 truncate">{story.title}</p>
                  <p className="text-gray-600 text-xs mt-0.5 font-mono">/news/{story.slug}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/news/${story.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700
                               hover:border-gray-500 rounded-lg transition-colors"
                  >
                    View ↗
                  </Link>
                  <Link
                    href={`/admin/stories/${story.id}/edit`}
                    className="px-3 py-1.5 text-xs text-white bg-gray-700 hover:bg-gray-600
                               rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={deleting === story.id}
                    onClick={() => handleDelete(story.id, story.title)}
                    className="px-3 py-1.5 text-xs text-red-400 hover:text-white hover:bg-red-900/50
                               border border-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting === story.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
