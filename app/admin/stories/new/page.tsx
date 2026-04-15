'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import StoryEditor from '@/components/admin/StoryEditor'

export default function NewStoryPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!user)                     router.push('/login?redirect=/admin/stories/new')
      else if (profile?.role !== 'admin') router.push('/dashboard?error=admin_required')
    }
  }, [user, profile, isLoading, router])

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
          <h1 className="text-3xl font-bold">New Story</h1>
          <p className="text-gray-400 text-sm mt-1">
            Fill in the details below and click <strong className="text-white">Publish story</strong> when ready.
          </p>
        </div>

        <StoryEditor />

      </div>
    </div>
  )
}
