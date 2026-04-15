'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import StoryEditor, { type StoryFormData } from '@/components/admin/StoryEditor'

export default function EditStoryPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [initial,  setInitial]  = useState<StoryFormData | null>(null)
  const [fetching, setFetching] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      if (!user)                     router.push('/login')
      else if (profile?.role !== 'admin') router.push('/dashboard?error=admin_required')
    }
  }, [user, profile, isLoading, router])

  // ── Fetch story data (full record including content) ──────────────────────
  useEffect(() => {
    if (!user || profile?.role !== 'admin' || !id) return

    fetch(`/api/admin/stories/${id}`)
      .then(r => r.json())
      .then(json => {
        const story = json.story
        if (!story) {
          setFetchErr('Story not found')
        } else {
          setInitial({
            id:              story.id,
            slug:            story.slug,
            category:        story.category,
            category_icon:   story.category_icon,
            title:           story.title,
            description:     story.description,
            gradient:        story.gradient,
            accent_colour:   story.accent_colour,
            cover_image_url: story.cover_image_url ?? '',
            content:         story.content ?? [],
            published_at:    story.published_at,
          })
        }
      })
      .catch(() => setFetchErr('Failed to load story'))
      .finally(() => setFetching(false))
  }, [user, profile, id])

  if (isLoading || !user || profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/stories"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            ← Stories
          </Link>
          <h1 className="text-3xl font-bold">Edit Story</h1>
          {initial && (
            <p className="text-gray-400 text-sm mt-1 font-mono">/news/{initial.slug}</p>
          )}
        </div>

        {fetching ? (
          <div className="text-gray-500 text-sm animate-pulse py-12 text-center">Loading story…</div>
        ) : fetchErr ? (
          <div className="text-red-400 text-sm py-12 text-center">{fetchErr}</div>
        ) : initial ? (
          <StoryEditor initial={initial} />
        ) : null}

      </div>
    </div>
  )
}
