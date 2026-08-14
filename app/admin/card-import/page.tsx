import Link from 'next/link'
import { GenericCardImport } from '@/components/admin/GenericCardImport'

/**
 * /admin/card-import
 *
 * Admin page for importing card data for non-Pokémon games (e.g. Moomin).
 * Pokémon data should use the dedicated /admin/card-data-import scraper tool.
 *
 * Auth is enforced client-side inside <GenericCardImport>.
 */
export default function CardImportPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <span>←</span>
            <span>Back to Admin Panel</span>
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📋</span>
            <h1 className="text-4xl font-bold">Card Data Import</h1>
          </div>

          <p className="text-gray-400 text-lg mt-1">
            Non-Pokémon games (Moomin, etc.)
          </p>

          <p className="text-gray-500 text-sm mt-3 max-w-2xl">
            Import sets and cards from a JSON payload. The import is{' '}
            <strong className="text-gray-300">idempotent</strong> — safe to re-run: sets matched
            by name + game and cards matched by number + set are silently skipped. Image URLs are
            stored as-is; use the{' '}
            <Link href="/admin/image-upload" className="text-yellow-400 hover:text-yellow-300 underline">
              Image Upload
            </Link>{' '}
            tool to manage card images separately.
          </p>

          {/* Notice for Pokémon */}
          <div className="mt-4 inline-flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-yellow-300 max-w-2xl">
            <span className="text-base">⚠️</span>
            <span>
              This tool does <strong>not</strong> support Pokémon. For Pokémon card data, use the{' '}
              <Link
                href="/admin/card-data-import"
                className="text-yellow-400 hover:text-yellow-200 underline"
              >
                Pokémon Card Data Import
              </Link>{' '}
              tool (pkmn.gg scraper).
            </span>
          </div>
        </div>

        {/* Main import UI — client component handles its own auth guard */}
        <GenericCardImport />
      </div>
    </div>
  )
}
