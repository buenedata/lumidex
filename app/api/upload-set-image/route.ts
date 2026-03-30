import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase'

/** Standardised filename for a set logo: "{setId}-logo.jpg" */
function generateSetLogoFilename(setId: string): string {
  return `${setId}-logo.jpg`
}

export async function POST(request: NextRequest) {
  // 1. Verify caller is an admin
  try {
    await requireAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    )
  }

  // 2. Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file  = formData.get('file')  as File   | null
  const setId = formData.get('setId') as string | null

  if (!file || !setId) {
    return NextResponse.json(
      { error: 'Missing required fields: file, setId' },
      { status: 400 },
    )
  }

  // 3. Basic file validation
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be smaller than 5 MB' }, { status: 400 })
  }

  // 4. Upload to set-images bucket (service role bypasses RLS)
  const filename   = generateSetLogoFilename(setId)
  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabaseAdmin.storage
    .from('set-images')
    .upload(filename, fileBuffer, {
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) {
    console.error('[upload-set-image] Storage error:', uploadError)
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 502 },
    )
  }

  // 5. Resolve public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('set-images')
    .getPublicUrl(filename)
  const logoUrl = urlData.publicUrl

  // 6. Update sets table — note: PK column is set_id, not id
  const { error: dbError } = await supabaseAdmin
    .from('sets')
    .update({ logo_url: logoUrl })
    .eq('set_id', setId)

  if (dbError) {
    console.error('[upload-set-image] DB update error:', dbError)
    return NextResponse.json(
      { error: `Database update failed: ${dbError.message}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true, logoUrl })
}
