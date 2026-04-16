'use client'

import Link from 'next/link'

export default function AdminPricesPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
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
            <h1 className="text-3xl font-bold">Price Management</h1>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            The pricing system is being rebuilt. New TCGGO-powered pricing coming soon.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4">
          <span className="text-5xl">🚧</span>
          <h2 className="text-xl font-semibold text-white">New Pricing System Coming Soon</h2>
          <p className="text-gray-400 text-sm max-w-md">
            The old TCGPlayer + CardMarket pricing pipeline has been retired.
            A new TCGGO-powered pricing system is being built and will be available shortly.
          </p>
        </div>
      </div>
    </div>
  )
}
