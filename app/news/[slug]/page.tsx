import { notFound } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Block =
  | { type: 'p';       text: string }
  | { type: 'h2';      text: string }
  | { type: 'h3';      text: string }
  | { type: 'ol';      items: string[] }
  | { type: 'ul';      items: string[] }
  | { type: 'callout'; text: string }
  | { type: 'image';   url: string; alt: string; caption?: string }

interface Story {
  id:              string
  slug:            string
  category:        string
  category_icon:   string
  title:           string
  description:     string
  gradient:        string
  cover_image_url: string | null
  content:         Block[]
  published_at:    string
}

// ── Data fetching (server component) ─────────────────────────────────────────

async function fetchStory(slug: string): Promise<Story | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/stories/${slug}`, {
      next: { revalidate: 60 }, // ISR: refresh at most every 60 s
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.story ?? null
  } catch {
    return null
  }
}

// ── Block renderer ────────────────────────────────────────────────────────────

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2
          className="text-xl sm:text-2xl font-bold text-primary mt-10 mb-3"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {block.text}
        </h2>
      )

    case 'h3':
      return (
        <h3
          className="text-lg font-semibold text-primary mt-7 mb-2"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {block.text}
        </h3>
      )

    case 'p':
      return (
        <p className="text-secondary text-base leading-relaxed mb-4">
          {block.text}
        </p>
      )

    case 'ol':
      return (
        <ol className="list-decimal list-outside ml-5 space-y-3 mb-6">
          {block.items.map((item, i) => (
            <li key={i} className="text-secondary text-base leading-relaxed pl-1">
              {item}
            </li>
          ))}
        </ol>
      )

    case 'ul':
      return (
        <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
          {block.items.map((item, i) => (
            <li key={i} className="text-secondary text-base leading-relaxed pl-1">
              {item}
            </li>
          ))}
        </ul>
      )

    case 'callout':
      return (
        <div className="my-8 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5">
          <p className="text-primary text-base leading-relaxed font-medium">
            {block.text}
          </p>
        </div>
      )

    case 'image':
      return (
        <figure className="my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt}
            className="w-full rounded-2xl border border-white/10 object-cover"
          />
          {block.caption && (
            <figcaption className="text-center text-xs text-muted mt-2">
              {block.caption}
            </figcaption>
          )}
        </figure>
      )

    default:
      return null
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>
}

export default async function StoryArticlePage({ params }: Props) {
  const { slug } = await params
  const story = await fetchStory(slug)

  if (!story) notFound()

  const formattedDate = new Date(story.published_at).toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  })

  return (
    <div className="min-h-screen bg-base">

      {/* ── Hero band ──────────────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ background: story.gradient }}
      >
        {/* Optional cover image */}
        {story.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.cover_image_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-25"
          />
        )}

        {/* Noise texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            backgroundSize: '128px 128px',
          }}
        />

        {/* Bottom fade into page bg */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(12,12,20,0.95))',
          }}
        />

        <div className="relative max-w-3xl mx-auto px-6 pt-10 pb-16">

          {/* Back link */}
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm
                       transition-colors duration-150 mb-8"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Stories
          </Link>

          {/* Category badge */}
          <div className="mb-5">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                         bg-black/40 text-white border border-white/20 backdrop-blur-sm"
            >
              <span role="img" aria-label={story.category}>{story.category_icon}</span>
              {story.category}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {story.title}
          </h1>

          {/* Lead / description */}
          <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-2xl mb-6">
            {story.description}
          </p>

          {/* Date */}
          <p className="text-white/40 text-xs font-medium tracking-wide uppercase">
            {formattedDate}
          </p>

        </div>
      </div>

      {/* ── Article body ───────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        {story.content.map((block, i) => (
          <RenderBlock key={i} block={block} />
        ))}

        {/* Back to stories */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent
                       transition-colors duration-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Stories
          </Link>
        </div>
      </main>

    </div>
  )
}
