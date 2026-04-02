'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { RecompressImages } from '../../../components/admin/RecompressImages'

export default function RecompressPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link href="/admin" className="hover:text-yellow-400 transition-colors">
              🛠️ Admin
            </Link>
            <span>/</span>
            <span className="text-white">Recompress Images</span>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🗜️ Recompress Images
          </h1>
          <p className="text-gray-400 mt-1">
            Re-encode existing storage images to WebP to reclaim Supabase storage space.
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-6 p-4 bg-yellow-950 border border-yellow-700 rounded-xl text-sm text-yellow-200 space-y-1">
          <p className="font-semibold text-yellow-400">⚡ How it works</p>
          <p>
            Downloads every image in the selected bucket, compresses it to{' '}
            <strong>WebP at 82 % quality / max 500 px wide</strong>, then re-uploads
            it in-place. Files already smaller after compression are skipped untouched.
          </p>
          <p className="text-yellow-300 font-medium">
            Expected saving: 85–90 % per image vs raw PNG — run Card Images first,
            it holds the most data.
          </p>
        </div>

        {/* Tool */}
        <div className="p-5 bg-gray-900 border border-gray-800 rounded-xl">
          <RecompressImages defaultBucket="card-images" />
        </div>

      </div>
    </div>
  )
}
