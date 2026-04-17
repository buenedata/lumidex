// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/prices/sync-products/route.ts
//
// POST /api/admin/prices/sync-products
// Syncs sealed product prices from TCGGO for every set_product that has a
// known api_product_id.
//
// Strategy:
//   1. Load all api_product_id values from set_products.
//   2. Paginate through GET /pokemon/products from TCGGO.
//   3. For each TCGGO product whose id matches one of ours, extract
//      prices.cardmarket.lowest and upsert into item_prices.
//
// Batches upserts in groups of UPSERT_BATCH to avoid timeouts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TCGGO_BASE_URL = 'https://cardmarket-api-tcg.p.rapidapi.com'
const PER_PAGE       = 100
const UPSERT_BATCH   = 50

// ── TCGGO type shapes ─────────────────────────────────────────────────────────

interface TcggoProductEntry {
  id: number | string
  prices?: {
    cardmarket?: {
      lowest?: number | null
      currency?: string
    } | null
  }
}

interface TcggoProductsResponse {
  data: TcggoProductEntry[]
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  // ── 1. Load all known product IDs from Supabase ───────────────────────────
  const { data: productRows, error: dbError } = await supabaseAdmin
    .from('set_products')
    .select('api_product_id')
    .not('api_product_id', 'is', null)

  if (dbError) {
    return NextResponse.json(
      { error: 'Failed to fetch set_products', detail: dbError.message },
      { status: 500 },
    )
  }

  const knownIds = new Set(
    (productRows ?? []).map((r: { api_product_id: string }) => String(r.api_product_id)),
  )

  if (knownIds.size === 0) {
    return NextResponse.json({
      success: true,
      total: 0,
      synced: 0,
      skipped: 0,
      failed: 0,
      note: 'No set_products with api_product_id found',
    })
  }

  // ── 2. Fetch all products from TCGGO (paginated) ──────────────────────────
  const matched: Array<{ item_id: string; price: number | null }> = []

  try {
    let page = 1
    while (true) {
      const url = `${TCGGO_BASE_URL}/pokemon/products?per_page=${PER_PAGE}&page=${page}`

      const res = await fetch(url, {
        headers: {
          'X-RapidAPI-Key':  process.env.RAPIDAPI_KEY ?? '',
          'X-RapidAPI-Host': 'cardmarket-api-tcg.p.rapidapi.com',
        },
      })

      if (!res.ok) {
        const detail = await res.text()
        return NextResponse.json(
          { error: 'Failed to fetch from TCGGO', status: res.status, detail },
          { status: 502 },
        )
      }

      const json     = (await res.json()) as TcggoProductsResponse
      const pageData = Array.isArray(json?.data) ? json.data : []

      for (const product of pageData) {
        const id = String(product.id)
        if (knownIds.has(id)) {
          matched.push({
            item_id: id,
            price:   product.prices?.cardmarket?.lowest ?? null,
          })
        }
      }

      if (pageData.length < PER_PAGE) break
      page++
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'Failed to fetch from TCGGO', detail },
      { status: 502 },
    )
  }

  // ── 3. Build upsert rows ──────────────────────────────────────────────────
  const now  = new Date().toISOString()
  const rows = matched.map(({ item_id, price }) => ({
    item_id,
    item_type:  'product',
    variant:    'normal',
    price,
    currency:   'EUR',
    source:     'tcggo',
    updated_at: now,
  }))

  // ── 4. Batch upserts ──────────────────────────────────────────────────────
  let synced  = 0
  let skipped = 0
  let failed  = 0

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)

    const { error: upsertError } = await supabaseAdmin
      .from('item_prices')
      .upsert(batch, { onConflict: 'item_id,item_type,variant' })

    if (upsertError) {
      console.error('[sync-products] Upsert batch error:', upsertError)
      failed += batch.length
    } else {
      for (const row of batch) {
        if (row.price === null) skipped++
        else synced++
      }
    }
  }

  // ── 5. Return summary ─────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    total:   rows.length,
    synced,
    skipped,
    failed,
  })
}
