import Link from 'next/link'
import { MtgSetImport } from '@/components/admin/MtgSetImport'

/**
 * /admin/mtg-import
 *
 * Admin page for importing Magic: The Gathering sets and cards from Scryfall.
 * Shows the 20 most recent expansion, core, and Masters sets by default.
 * Auth is enforced client-side inside <MtgSetImport>.
 */
export default function MtgImportPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <span>←</span>
            <span>Back to Admin Panel</span>
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🧙</span>
            <h1 className="text-4xl font-bold">MTG Set Import</h1>
          </div>

          <p className="text-gray-400 text-lg mt-1">
            Magic: The Gathering — powered by{' '}
            <a
              href="https://scryfall.com/docs/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              Scryfall API
            </a>
          </p>

          <p className="text-gray-500 text-sm mt-3 max-w-2xl">
            Showing the 20 most recently released{' '}
            <strong className="text-gray-300">expansion</strong>,{' '}
            <strong className="text-gray-300">core</strong>, and{' '}
            <strong className="text-gray-300">Masters</strong> sets. Imports are{' '}
            <strong className="text-gray-300">idempotent</strong> — safe to re-run. Card images
            are served directly from Scryfall&apos;s CDN. Use the{' '}
            <Link
              href="/admin/recompress"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              Recompress
            </Link>{' '}
            tool to mirror images to R2 later if needed.
          </p>

          {/* Info notice */}
          <div className="mt-4 inline-flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 text-sm text-blue-300 max-w-2xl">
            <span className="text-base shrink-0">ℹ️</span>
            <span>
              Each set import fetches cards page-by-page from Scryfall (175 cards/page) with
              a short delay between requests. A large set (~300 cards) takes about 5–10 seconds.
            </span>
          </div>
        </div>

        {/* Import UI */}
        <MtgSetImport />

      </div>
    </div>
  )
}
