// ─────────────────────────────────────────────────────────────────────────────
// app/api/admin/prices/sync-products/route.ts
//
// POST /api/admin/prices/sync-products
// Syncs sealed product prices from TCGGO for every product in a given set.
//
// Strategy:
//   1. Accept a setId from the request body.
//   2. Resolve the TCGGO episode ID (api_set_id) for that set.
//   3. Paginate GET /pokemon/episodes/{episodeId}/products from TCGGO —
//      fetching ALL products for the chosen set, not just those already
//      known to have an api_product_id.
//   4. Extract prices.cardmarket.lowest and upsert into item_prices.
//   5. Back-fill set_products.api_product_id for any matching row in the
//      same set that shares the product name (best-effort, non-blocking).
//
// Batches upserts in groups of UPSERT_BATCH to avoid timeouts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TCGGO_BASE_URL = 'https://cardmarket-api-tcg.p.rapidapi.com'
const PER_PAGE       = 100
const UPSERT_BATCH   = 50

// ── TCGGO type shapes ─────────────────────────────────────────────────────────

interface TcggoProductEntry {
  id: number | string
  name?: string | null
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

export async function POST(req: NextRequest) {
  // ── 1. Parse & validate ───────────────────────────────────────────────────
  let setId: string
  try {
    const body = await req.json()
    setId      = body?.setId
    if (!setId || typeof setId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid setId' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── 2. Resolve TCGGO episode ID ───────────────────────────────────────────
  const { data: setRow, error: setError } = await supabaseAdmin
    .from('sets')
    .select('api_set_id')
    .eq('set_id', setId)
    .maybeSingle()

  if (setError || !setRow || !setRow.api_set_id) {
    return NextResponse.json(
      { error: 'Set not found or missing TCGGO episode ID' },
      { status: 400 },
    )
  }

  const episodeId = setRow.api_set_id as string

  // ── 3. Fetch all products for this episode from TCGGO (paginated) ─────────
  // Uses the episode-scoped endpoint so only products for the chosen set are
  // returned — identical pagination pattern to sync-set's card fetch.
  const allProducts: TcggoProductEntry[] = []

  try {
    let page = 1
    while (true) {
      const url = `${TCGGO_BASE_URL}/pokemon/episodes/${episodeId}/products?per_page=${PER_PAGE}&page=${page}`

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

      allProducts.push(...pageData)
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

  if (allProducts.length === 0) {
    return NextResponse.json({
      success: true,
      total:   0,
      synced:  0,
      skipped: 0,
      failed:  0,
      note:    'TCGGO returned no products for this episode',
    })
  }

  // ── 4. Build upsert rows ──────────────────────────────────────────────────
  const now  = new Date().toISOString()
  const rows = allProducts.map((product) => ({
    item_id:    String(product.id),
    item_type:  'product',
    variant:    'normal',
    price:      product.prices?.cardmarket?.lowest ?? null,
    currency:   'EUR',
    source:     'tcggo',
    updated_at: now,
  }))

  // ── 5. Batch upserts ──────────────────────────────────────────────────────
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

  // ── 6. Back-fill api_product_id on set_products rows (best-effort) ────────
  // For any TCGGO product whose name matches a set_products row in this set
  // that has no api_product_id yet, write it back so future syncs are faster.
  try {
    const productsWithNames = allProducts.filter((p) => p.name)
    if (productsWithNames.length > 0) {
      const { data: localProducts } = await supabaseAdmin
        .from('set_products')
        .select('id, name, api_product_id')
        .eq('set_id', setId)
        .is('api_product_id', null)

      if (localProducts && localProducts.length > 0) {
        const nameToTcggoId = new Map(
          productsWithNames.map((p) => [String(p.name).toLowerCase().trim(), String(p.id)]),
        )
        for (const local of localProducts) {
          const match = nameToTcggoId.get(String(local.name).toLowerCase().trim())
          if (match) {
            await supabaseAdmin
              .from('set_products')
              .update({ api_product_id: match })
              .eq('id', local.id)
          }
        }
      }
    }
  } catch (backfillErr) {
    // Non-fatal — prices were already upserted; log and continue
    console.warn('[sync-products] Back-fill api_product_id failed (non-fatal):', backfillErr)
  }

  // ── 7. Return summary ─────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    total:   rows.length,
    synced,
    skipped,
    failed,
  })
}
