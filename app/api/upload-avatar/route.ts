import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { compressImageToWebP, COMPRESSED_CONTENT_TYPE } from '@/lib/imageCompress'
import { uploadToR2, getR2Url } from '@/lib/r2'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

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
      { error: 'File too large. Maximum size is 2 MB' },
      { status: 400 }
    )
  }

  // 4. Build storage path and compress to WebP
  const storagePath = `${user.id}/${user.id}.webp`
  const r2Key       = `avatars/${storagePath}`
  const fileBuffer  = await file.arrayBuffer()
  let uploadBuffer: Buffer | ArrayBuffer = fileBuffer
  let uploadContentType: string = file.type
  try {
    uploadBuffer = await compressImageToWebP(fileBuffer)
    uploadContentType = COMPRESSED_CONTENT_TYPE
  } catch {
    // Fallback: upload original bytes if compression unexpectedly fails
  }

  // 5. Upload to R2 (session already verified above)
  try {
    await uploadToR2(r2Key, uploadBuffer, uploadContentType)
  } catch (err) {
    console.error('[upload-avatar] R2 upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // 6. Get public URL
  const stableUrl = getR2Url(r2Key)

  // Store stable URL in DB so every request hits the same CDN cache key;
  // return a cache-busted URL to the browser so the client sees the new image immediately.
  const avatarUrl = `${stableUrl}?t=${Date.now()}`

  // 7. Persist URL on the users row
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ avatar_url: stableUrl })
    .eq('id', user.id)

  if (updateError) {
    console.error('[upload-avatar] DB update error:', updateError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  // Fire-and-forget: check & unlock any newly earned achievements (Picture Perfect)
  checkAndUnlockAchievements(user.id, supabaseAdmin).catch(err =>
    console.error('[upload-avatar] achievement check failed:', err)
  )

  return NextResponse.json({ avatarUrl })
}
