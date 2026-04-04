import { NextRequest, NextResponse } from 'next/server'

// Only allow fetching from these trusted image domains
const ALLOWED_DOMAINS = [
  // pkmn.gg
  'pkmn.gg',
  'www.pkmn.gg',
  'assets.pkmn.gg',
  'site.pkmn.gg',
  // TCGCollector
  'tcgcollector.com',
  'www.tcgcollector.com',
  'static.tcgcollector.com',
  // dext TCG
  'dextcg.com',
  'www.dextcg.com',
  'app.dextcg.com',
  'cdn.dextcg.com',
  // Other trusted sources
  'public.getcollectr.com',
  'limitlesstcg.com',
  'www.limitlesstcg.com',
  'bulbapedia.bulbagarden.net',
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate it is an https URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 })
  }

  if (parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only https URLs are allowed' }, { status: 400 })
  }

  // Domain allow-list check — prevents open proxy abuse
  if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
    return NextResponse.json(
      { error: `Domain not allowed: ${parsedUrl.hostname}` },
      { status: 403 }
    )
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        // Some CDNs require a referer header
        Referer: `https://${parsedUrl.hostname}/`,
        'User-Agent': 'Mozilla/5.0 (compatible; Lumidex/1.0)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${response.status} ${response.statusText}` },
        { status: 502 }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Only pass through image content types
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: `Upstream response is not an image: ${contentType}` },
        { status: 415 }
      )
    }

    const imageBuffer = await response.arrayBuffer()

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[proxy-image] Fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  }
}
