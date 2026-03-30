import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// GET: Fetch cards that need rarity data
export async function GET() {
  try {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, name')
      .is('rarity', null)
      .limit(100)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      cards: cards || [],
      count: cards?.length || 0 
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Update a card's rarity
export async function POST(request: Request) {
  try {
    const { cardId, rarity } = await request.json()
    
    const { error } = await supabase
      .from('cards')
      .update({ rarity })
      .eq('id', cardId)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}