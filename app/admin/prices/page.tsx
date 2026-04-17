import Link from 'next/link'
import PriceSyncTool from '@/components/admin/PriceSyncTool'

export default function AdminPricesPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <span>←</span>
            <span>Back to Admin</span>
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">💰</span>
            <h1 className="text-3xl font-bold">Price Data Sync</h1>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Bulk-sync Cardmarket prices for all cards in a set using the TCGGO episode endpoint.
            Prices are upserted into <code className="text-yellow-400">item_prices</code> and
            cached for 24 hours.
          </p>
        </div>

        {/* Tool card */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Sync Set Prices</h2>
          <PriceSyncTool />
        </div>

      </div>
    </div>
  )
}
