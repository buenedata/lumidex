import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { GRADING_COMPANIES } from '@/types'
import type { GradingCompany } from '@/types'

/**
 * /api/graded-cards
 *
 * GET  ?cardId=<uuid>
 *   Returns all graded card entries for the authenticated user for the given card.
 *   Response: { gradedCards: UserGradedCard[] }
 *
 * POST
 *   Body: { cardId, variantId, gradingCompany, grade, quantity, setId }
 *   Upserts a graded card entry. quantity must be >= 1.
 *   Response: { gradedCard: UserGradedCard }
 *
 * DELETE
 *   Body: { id }
 *   Deletes a graded card entry by primary key.
 *   Response: { success: true }
 */

async function getAuthUser() {
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error } = await serverClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const cardId = searchParams.get('cardId')
  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('user_graded_cards')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_id', cardId)
    .order('grading_company')
    .order('grade')

  if (error) {
    console.error('[graded-cards GET] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ gradedCards: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { cardId, variantId, gradingCompany, grade, quantity, setId } = body

  // Validate required fields
  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 })
  }
  if (!gradingCompany || !GRADING_COMPANIES.includes(gradingCompany as GradingCompany)) {
    return NextResponse.json(
      { error: `gradingCompany must be one of: ${GRADING_COMPANIES.join(', ')}` },
      { status: 400 },
    )
  }
  if (!grade || typeof grade !== 'string' || grade.trim() === '') {
    return NextResponse.json({ error: 'grade is required' }, { status: 400 })
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json({ error: 'quantity must be an integer >= 1' }, { status: 400 })
  }
  if (!setId) {
    return NextResponse.json({ error: 'setId is required' }, { status: 400 })
  }

  // Upsert the graded card row
  const { data, error } = await supabaseAdmin
    .from('user_graded_cards')
    .upsert(
      {
        user_id: user.id,
        card_id: cardId,
        variant_id: variantId ?? null,
        grading_company: gradingCompany,
        grade: grade.trim(),
        quantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,card_id,variant_id,grading_company,grade' },
    )
    .select()
    .single()

  if (error) {
    console.error('[graded-cards POST] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Auto-add set to user_sets (fire-and-forget; non-fatal if it fails)
  supabaseAdmin
    .from('user_sets')
    .upsert({ user_id: user.id, set_id: setId }, { onConflict: 'user_id,set_id' })
    .then(({ error: setErr }) => {
      if (setErr) console.error('[graded-cards POST] user_sets upsert error:', setErr)
    })

  return NextResponse.json({ gradedCard: data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id } = body
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // RLS ensures users can only delete their own rows; also enforce in query
  const { error } = await supabaseAdmin
    .from('user_graded_cards')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[graded-cards DELETE] DB error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
