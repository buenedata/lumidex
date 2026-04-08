import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * PATCH /api/trade-proposals/[id]
 *
 * Updates the status of a trade proposal.
 * Body: { status: 'accepted' | 'declined' | 'withdrawn' }
 *
 * Transition rules:
 *  - Only the RECEIVER can accept or decline
 *  - Only the PROPOSER can withdraw
 *  - Only pending proposals can be transitioned
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { status: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { status } = body
  const validStatuses = ['accepted', 'declined', 'withdrawn']
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(', ')}` },
      { status: 400 },
    )
  }

  // Fetch the proposal
  const { data: proposal, error: fetchError } = await supabaseAdmin
    .from('trade_proposals')
    .select('id, proposer_id, receiver_id, status')
    .eq('id', id)
    .single()

  if (fetchError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const isProposer = proposal.proposer_id === user.id
  const isReceiver = proposal.receiver_id === user.id

  if (!isProposer && !isReceiver) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (proposal.status !== 'pending') {
    return NextResponse.json(
      { error: `Proposal is already ${proposal.status}` },
      { status: 409 },
    )
  }

  if (status === 'withdrawn' && !isProposer) {
    return NextResponse.json({ error: 'Only the proposer can withdraw' }, { status: 403 })
  }
  if ((status === 'accepted' || status === 'declined') && !isReceiver) {
    return NextResponse.json({ error: 'Only the receiver can accept or decline' }, { status: 403 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('trade_proposals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    console.error('[trade-proposals PATCH] update error:', updateError)
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status })
}
