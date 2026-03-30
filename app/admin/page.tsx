'use client'

import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AdminTool {
  href: string
  icon: string
  title: string
  description: string
  badge?: string
}

const ADMIN_TOOLS: AdminTool[] = [
  {
    href: '/admin/set-images',
    icon: '🗂️',
    title: 'Set Image Upload',
    description:
      'Drag set logos from pkmn.gg directly into the uploader. Logos are stored in Supabase and displayed on the sets browse page.',
    badge: 'Storage',
  },
  {
    href: '/admin/set-symbols',
    icon: '🔷',
    title: 'Set Symbol Upload',
    description:
      'Drag set symbol icons from pkmn.gg directly into the uploader. Symbols appear as a small badge in the bottom-left corner of every set card.',
    badge: 'Storage',
  },
  {
    href: '/admin/card-images',
    icon: '🖼️',
    title: 'Card Image Upload',
    description:
      'Drag card images from pkmn.gg directly into the uploader. Images are automatically stored in Supabase and linked to the correct card.',
    badge: 'Storage',
  },
  {
    href: '/admin/card-data-import',
    icon: '🎨',
    title: 'Card Data Import',
    description:
      'Bulk-import artist, HP, type, subtype and element data for every card in a set by providing a pkmn.gg set page URL.',
    badge: 'Import',
  },
  {
    href: '/admin/variants',
    icon: '⚙️',
    title: 'Variant Management',
    description:
      'Create, edit and delete card variants. Review and approve or reject user-submitted variant suggestions.',
    badge: 'Database',
  },
  {
    href: '/admin/rarity-import',
    icon: '📦',
    title: 'Rarity Import',
    description:
      'Bulk-import rarity data for cards from external sources. Maps TCG rarity strings to the database.',
    badge: 'Import',
  },
]

export default function AdminHubPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/admin')
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
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🛠️</span>
            <h1 className="text-4xl font-bold">Admin Panel</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Welcome back,{' '}
            <span className="text-yellow-400 font-medium">{profile?.username}</span>. Choose a tool
            below.
          </p>
        </div>

        {/* Tool cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ADMIN_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group relative flex flex-col bg-gray-900 border border-gray-700 rounded-xl p-6 hover:border-yellow-500 hover:bg-gray-800 transition-all duration-200 cursor-pointer"
            >
              {/* Badge */}
              {tool.badge && (
                <span className="absolute top-4 right-4 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 group-hover:bg-yellow-500/20 group-hover:text-yellow-400 transition-colors">
                  {tool.badge}
                </span>
              )}

              {/* Icon */}
              <div className="text-4xl mb-4">{tool.icon}</div>

              {/* Title */}
              <h2 className="text-xl font-semibold mb-2 group-hover:text-yellow-400 transition-colors">
                {tool.title}
              </h2>

              {/* Description */}
              <p className="text-gray-400 text-sm leading-relaxed flex-1">{tool.description}</p>

              {/* Arrow */}
              <div className="mt-5 flex items-center text-sm text-gray-500 group-hover:text-yellow-400 transition-colors">
                Open tool
                <svg
                  className="ml-1.5 w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-12 text-center text-xs text-gray-600">
          Admin tools are only visible to users with the <code className="font-mono">admin</code> role.
        </p>
      </div>
    </div>
  )
}
