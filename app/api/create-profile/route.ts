import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, username, avatarUrl } = await request.json()

    if (!userId || !username) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and username' },
        { status: 400 }
      )
    }

    console.log('🔍 Server-side profile creation for user:', userId)

    // Create profile directly - let database constraints handle validation
    // The foreign key will ensure the auth user exists
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: userId,
          username,
          avatar_url: avatarUrl
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('❌ Server-side profile creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create user profile', details: error },
        { status: 500 }
      )
    }

    console.log('✅ Server-side profile created successfully:', data)
    return NextResponse.json({ data })

  } catch (error) {
    console.error('❌ Server-side profile creation exception:', error)
    return NextResponse.json(
      { error: 'Server error during profile creation' },
      { status: 500 }
    )
  }
}