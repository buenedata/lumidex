'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import StoryBlockEditor, { type Block } from './StoryBlockEditor'

// ── Category presets ──────────────────────────────────────────────────────────

const CATEGORY_PRESETS = [
  {
    category:     'Value',
    categoryIcon: '💎',
    gradient:     'linear-gradient(145deg, #2e1065 0%, #4c1d95 35%, #6d28d9 70%, #7c3aed 100%)',
    accentColour: 'text-purple-300',
  },
  {
    category:     'Trivia',
    categoryIcon: '✨',
    gradient:     'linear-gradient(145deg, #78350f 0%, #b45309 40%, #d97706 75%, #f59e0b 100%)',
    accentColour: 'text-amber-300',
  },
  {
    category:     'Sets',
    categoryIcon: '🔥',
    gradient:     'linear-gradient(145deg, #164e63 0%, #0e7490 40%, #0891b2 75%, #22d3ee 100%)',
    accentColour: 'text-cyan-300',
  },
  {
    category:     'Art',
    categoryIcon: '🎨',
    gradient:     'linear-gradient(145deg, #500724 0%, #9d174d 40%, #be185d 75%, #f472b6 100%)',
    accentColour: 'text-pink-300',
  },
  {
    category:     'Market',
    categoryIcon: '📈',
    gradient:     'linear-gradient(145deg, #064e3b 0%, #065f46 40%, #047857 75%, #10b981 100%)',
    accentColour: 'text-emerald-300',
  },
  {
    category:     'Competitive',
    categoryIcon: '🏆',
    gradient:     'linear-gradient(145deg, #1c1917 0%, #44403c 40%, #78716c 75%, #a8a29e 100%)',
    accentColour: 'text-stone-300',
  },
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StoryFormData {
  id?:             string
  slug:            string
  category:        string
  category_icon:   string
  title:           string
  description:     string
  gradient:        string
  accent_colour:   string
  cover_image_url: string
  content:         Block[]
  published_at:    string
}

interface StoryEditorProps {
  /** undefined = create mode; defined = edit mode */
  initial?: StoryFormData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StoryEditor({ initial }: StoryEditorProps) {
  const router = useRouter()
  const isEditing = Boolean(initial?.id)

  const presetForCategory = (cat: string) =>
    CATEGORY_PRESETS.find(p => p.category === cat) ?? CATEGORY_PRESETS[0]

  const defaultPreset = initial
    ? presetForCategory(initial.category)
    : CATEGORY_PRESETS[0]

  const [category,      setCategory]      = useState(initial?.category       ?? defaultPreset.category)
  const [categoryIcon,  setCategoryIcon]  = useState(initial?.category_icon  ?? defaultPreset.categoryIcon)
  const [title,         setTitle]         = useState(initial?.title          ?? '')
  const [slug,          setSlug]          = useState(initial?.slug           ?? '')
  const [description,   setDescription]   = useState(initial?.description    ?? '')
  const [gradient,      setGradient]      = useState(initial?.gradient       ?? defaultPreset.gradient)
  const [accentColour,  setAccentColour]  = useState(initial?.accent_colour  ?? defaultPreset.accentColour)
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.cover_image_url ?? '')
  const [content,       setContent]       = useState<Block[]>(initial?.content ?? [])
  const [publishedAt,   setPublishedAt]   = useState(
    initial?.published_at
      ? initial.published_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  )
  const [slugManual,    setSlugManual]    = useState(Boolean(initial?.slug))
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)

  const coverInputRef = useRef<HTMLInputElement>(null)

  // Auto-generate slug from title unless the user has manually edited it
  function handleTitleChange(val: string) {
    setTitle(val)
    if (!slugManual) setSlug(slugify(val))
  }

  // When a category preset is selected, update all related fields
  function handlePresetSelect(preset: typeof CATEGORY_PRESETS[number]) {
    setCategory(preset.category)
    setCategoryIcon(preset.categoryIcon)
    setGradient(preset.gradient)
    setAccentColour(preset.accentColour)
  }

  // Cover image upload
  const handleCoverFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('File must be an image'); return }
    const storyId = initial?.id ?? 'new'
    const fd = new FormData()
    fd.append('file', file)
    fd.append('storyId', storyId)
    fd.append('type', 'cover')
    setCoverUploading(true)
    try {
      const res  = await fetch('/api/admin/stories/upload-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (res.ok && json.url) setCoverImageUrl(json.url)
      else alert(json.error ?? 'Cover upload failed')
    } catch {
      alert('Cover upload failed')
    } finally {
      setCoverUploading(false)
    }
  }, [initial?.id])

  async function handleSave() {
    setError(null)

    if (!title.trim())       { setError('Title is required');       return }
    if (!slug.trim())        { setError('Slug is required');        return }
    if (!description.trim()) { setError('Description is required'); return }

    setSaving(true)

    const payload = {
      slug:            slug.trim(),
      category,
      category_icon:   categoryIcon,
      title:           title.trim(),
      description:     description.trim(),
      gradient,
      accent_colour:   accentColour,
      cover_image_url: coverImageUrl.trim() || null,
      content,
      published_at:    new Date(publishedAt).toISOString(),
    }

    try {
      const url    = isEditing ? `/api/admin/stories/${initial!.id}` : '/api/admin/stories'
      const method = isEditing ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to save story')
        setSaving(false)
        return
      }

      router.push('/admin/stories')
      router.refresh()
    } catch {
      setError('Network error — please try again')
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Metadata ─────────────────────────────────────────────────────── */}
      <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-5">
        <h2 className="text-base font-semibold text-white">Metadata</h2>

        {/* Category presets */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_PRESETS.map(preset => (
              <button
                key={preset.category}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                  ${category === preset.category
                    ? 'bg-yellow-500 border-yellow-400 text-black'
                    : 'bg-gray-800 border-gray-600 text-white hover:border-yellow-500'
                  }`}
              >
                {preset.categoryIcon} {preset.category}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Title *</label>
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                       focus:outline-none focus:border-yellow-500 transition-colors"
            value={title}
            placeholder="Article title…"
            onChange={e => handleTitleChange(e.target.value)}
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Slug * <span className="text-gray-600">(auto-generated from title)</span>
          </label>
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                       font-mono focus:outline-none focus:border-yellow-500 transition-colors"
            value={slug}
            placeholder="url-friendly-slug"
            onChange={e => { setSlug(e.target.value); setSlugManual(true) }}
          />
          <p className="text-xs text-gray-600 mt-1">
            Public URL: <span className="text-gray-400">/news/{slug || '…'}</span>
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Description * <span className="text-gray-600">(shown on card + article lead)</span></label>
          <textarea
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                       resize-y focus:outline-none focus:border-yellow-500 transition-colors"
            rows={2}
            value={description}
            placeholder="One or two sentences describing the article…"
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Gradient preview */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Card gradient</label>
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-10 rounded-lg border border-gray-600 shrink-0"
              style={{ background: gradient }}
            />
            <input
              type="text"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-xs
                         font-mono focus:outline-none focus:border-yellow-500 transition-colors"
              value={gradient}
              onChange={e => setGradient(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Automatically set when you pick a category above.</p>
        </div>

        {/* Published date */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Published date</label>
          <input
            type="date"
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                       focus:outline-none focus:border-yellow-500 transition-colors"
            value={publishedAt}
            onChange={e => setPublishedAt(e.target.value)}
          />
        </div>
      </section>

      {/* ── Cover image ──────────────────────────────────────────────────── */}
      <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Cover image</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Optional. Displayed on the article card header and the hero band.
          </p>
        </div>

        {coverImageUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt="Cover preview"
              className="w-full max-h-48 object-cover rounded-xl border border-gray-700"
            />
            <button
              type="button"
              onClick={() => setCoverImageUrl('')}
              className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded-lg
                         hover:bg-red-900/80 transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => coverInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && coverInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleCoverFile(file)
            }}
            className="border-2 border-dashed border-gray-600 hover:border-yellow-500 rounded-xl
                       flex flex-col items-center justify-center py-10 cursor-pointer transition-colors"
          >
            {coverUploading ? (
              <span className="text-gray-400 text-sm animate-pulse">Uploading…</span>
            ) : (
              <>
                <span className="text-3xl mb-2">🖼️</span>
                <span className="text-gray-400 text-sm">Click or drag to upload cover image</span>
                <span className="text-gray-600 text-xs mt-1">JPG, PNG, WebP — max 5 MB</span>
              </>
            )}
          </div>
        )}

        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverFile(f) }}
        />

        {/* Or paste URL */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Or paste image URL</label>
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                       focus:outline-none focus:border-yellow-500 transition-colors"
            value={coverImageUrl}
            placeholder="https://…"
            onChange={e => setCoverImageUrl(e.target.value)}
          />
        </div>
      </section>

      {/* ── Content blocks ───────────────────────────────────────────────── */}
      <section className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-white">Article content</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Build the article by adding and arranging content blocks below.
          </p>
        </div>
        <StoryBlockEditor
          blocks={content}
          storyId={initial?.id}
          onChange={setContent}
        />
      </section>

      {/* ── Error / save ─────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pb-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50
                     text-black font-semibold text-sm rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Publish story'}
        </button>
      </div>

    </div>
  )
}
