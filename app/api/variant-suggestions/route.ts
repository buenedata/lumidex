import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { VariantSuggestion } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const cardId = searchParams.get('cardId')

    let query = supabase
      .from('variant_suggestions')
      .select(`
        *,
        users:created_by (username)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (cardId) {
      query = query.eq('card_id', cardId)
    }

    const { data: suggestions, error } = await query

    if (error) {
      console.error('Error fetching variant suggestions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch variant suggestions' },
        { status: 500 }
      )
    }

    return NextResponse.json(suggestions)

  } catch (error) {
    console.error('Unexpected error in variant-suggestions GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const body = await request.json()
    const { cardId, name, description, userId } = body

    if (!cardId || !name || !userId) {
      return NextResponse.json(
        { error: 'cardId, name, and userId are required' },
        { status: 400 }
      )
    }

    // Check if user already has a pending suggestion for this card with the same name
    const { data: existingSuggestion, error: checkError } = await supabase
      .from('variant_suggestions')
      .select('id')
      .eq('card_id', cardId)
      .eq('name', name)
      .eq('created_by', userId)
      .eq('status', 'pending')
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error checking existing suggestions:', checkError)
      return NextResponse.json(
        { error: 'Failed to check existing suggestions' },
        { status: 500 }
      )
    }

    if (existingSuggestion) {
      return NextResponse.json(
        { error: 'You already have a pending suggestion with this name for this card' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('variant_suggestions')
      .insert({
        card_id: cardId,
        name: name.trim(),
        description: description?.trim() || null,
        created_by: userId,
        status: 'pending'
      })
      .select('*')

    if (error) {
      console.error('Error creating variant suggestion:', error)
      return NextResponse.json(
        { error: 'Failed to create variant suggestion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Variant suggestion created successfully',
      data: data?.[0]
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in variant-suggestions POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Use the cookie-aware server client only for reading the suggestion (public SELECT policy).
    // All writes (INSERT into variants, UPDATE suggestion status) use supabaseAdmin so they
    // bypass RLS — the variants table has no INSERT policy and variant_suggestions has no
    // UPDATE policy for non-service-role clients.
    const supabase = await createSupabaseServerClient()
    const body = await request.json()
    const { suggestionId, status, userId } = body

    if (!suggestionId || !status || !userId) {
      return NextResponse.json(
        { error: 'suggestionId, status, and userId are required' },
        { status: 400 }
      )
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be either "accepted" or "rejected"' },
        { status: 400 }
      )
    }

    // TODO: Add admin check here - for now we'll allow any user to approve/reject
    // In production, you'd want to check if userId has admin privileges

    if (status === 'accepted') {
      // Get the suggestion details first (session client is fine — SELECT is public)
      const { data: suggestion, error: fetchError } = await supabase
        .from('variant_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .eq('status', 'pending')
        .single()

      if (fetchError) {
        console.error('Error fetching suggestion:', fetchError)
        return NextResponse.json(
          { error: 'Suggestion not found or already processed' },
          { status: 404 }
        )
      }

      if (!suggestion.card_id) {
        return NextResponse.json(
          { error: 'Suggestion is missing a card ID and cannot be approved as a card-specific variant' },
          { status: 400 }
        )
      }

      // Create a card-specific variant using supabaseAdmin (service role bypasses RLS).
      // Suggestions are always scoped to a card — the new variant must carry that card_id
      // so it appears only on the suggested card, not in the global catalog.
      const { data: newVariant, error: variantError } = await supabaseAdmin
        .from('variants')
        .insert({
          key: suggestion.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          name: suggestion.name,
          description: suggestion.description,
          color: 'blue', // Default color; admin can adjust later
          short_label: null,
          is_quick_add: true,  // Card-specific variants show as quick-add buttons on the card tile
          sort_order: 999,     // Put at end by default
          is_official: true,   // Admin has explicitly approved this variant
          created_by: suggestion.created_by,
          card_id: suggestion.card_id, // Scope to the specific card from the suggestion
        })
        .select('*')

      if (variantError) {
        console.error('Error creating variant from suggestion:', variantError)
        return NextResponse.json(
          { error: 'Failed to create variant from suggestion' },
          { status: 500 }
        )
      }

      // Update suggestion status using supabaseAdmin — no UPDATE policy exists for session clients
      const { error: updateError } = await supabaseAdmin
        .from('variant_suggestions')
        .update({ status: 'accepted' })
        .eq('id', suggestionId)

      if (updateError) {
        console.error('Error updating suggestion status:', updateError)
        // Note: variant was created but status wasn't updated - might need manual cleanup
        return NextResponse.json(
          { error: 'Variant created but failed to update suggestion status' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Variant suggestion accepted and variant created successfully',
        variant: newVariant?.[0]
      })

    } else {
      // Rejected — update status only using supabaseAdmin (no UPDATE policy for session clients)
      const { error: updateError } = await supabaseAdmin
        .from('variant_suggestions')
        .update({ status: 'rejected' })
        .eq('id', suggestionId)
        .eq('status', 'pending')

      if (updateError) {
        console.error('Error rejecting suggestion:', updateError)
        return NextResponse.json(
          { error: 'Failed to reject suggestion' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Variant suggestion rejected successfully'
      })
    }

  } catch (error) {
    console.error('Unexpected error in variant-suggestions PATCH API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}