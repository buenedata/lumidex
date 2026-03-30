import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  // 1. Verify authenticated session
  const serverClient = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }

  // 3. Validate file type and size
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 5 MB' },
      { status: 400 }
    )
  }

  // 4. Build storage path: {userId}/{userId}-banner.{ext}
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const storagePath = `${user.id}/${user.id}-banner.${ext}`
  const fileBuffer = await file.arrayBuffer()

  // 5. Upload via admin client (bypasses storage RLS; session already verified above)
  const { error: uploadError } = await supabaseAdmin.storage
    .from('banners')
    .upload(storagePath, fileBuffer, {
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) {
    console.error('[upload-banner] Storage error:', uploadError)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // 6. Get public URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('banners')
    .getPublicUrl(storagePath)

  // Add cache-bust query param so browsers reload the new image immediately
  const bannerUrl = `${publicUrl}?t=${Date.now()}`

  // 7. Persist URL on the users row
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ banner_url: bannerUrl })
    .eq('id', user.id)

  if (updateError) {
    console.error('[upload-banner] DB update error:', updateError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ bannerUrl })
}
