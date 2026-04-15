'use client'

import { useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Block =
  | { type: 'p';       text: string }
  | { type: 'h2';      text: string }
  | { type: 'h3';      text: string }
  | { type: 'ol';      items: string[] }
  | { type: 'ul';      items: string[] }
  | { type: 'callout'; text: string }
  | { type: 'image';   url: string; alt: string; caption?: string }

type BlockType = Block['type']

const BLOCK_LABELS: Record<BlockType, string> = {
  p:       'Paragraph',
  h2:      'Heading 2',
  h3:      'Heading 3',
  ol:      'Numbered list',
  ul:      'Bullet list',
  callout: 'Callout box',
  image:   'Image',
}

function defaultBlock(type: BlockType): Block {
  switch (type) {
    case 'p':       return { type: 'p',       text: '' }
    case 'h2':      return { type: 'h2',      text: '' }
    case 'h3':      return { type: 'h3',      text: '' }
    case 'ol':      return { type: 'ol',      items: [''] }
    case 'ul':      return { type: 'ul',      items: [''] }
    case 'callout': return { type: 'callout', text: '' }
    case 'image':   return { type: 'image',   url: '', alt: '', caption: '' }
  }
}

// ── Sub-editors ───────────────────────────────────────────────────────────────

interface TextBlockProps {
  value: string
  onChange: (val: string) => void
  rows?: number
  placeholder?: string
  mono?: boolean
}

function TextBlockInput({ value, onChange, rows = 3, placeholder = '', mono = false }: TextBlockProps) {
  return (
    <textarea
      className={`w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                  resize-y focus:outline-none focus:border-yellow-500 transition-colors
                  ${mono ? 'font-mono' : ''}`}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  )
}

interface ListBlockProps {
  items: string[]
  onChange: (items: string[]) => void
}

function ListBlockInput({ items, onChange }: ListBlockProps) {
  function update(i: number, val: string) {
    const next = [...items]
    next[i] = val
    onChange(next)
  }
  function addItem() {
    onChange([...items, ''])
  }
  function removeItem(i: number) {
    if (items.length <= 1) return
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 text-gray-500 text-xs w-4 shrink-0 text-right">{i + 1}.</span>
          <textarea
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                       resize-y focus:outline-none focus:border-yellow-500 transition-colors"
            rows={2}
            value={item}
            placeholder={`Item ${i + 1}`}
            onChange={e => update(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            disabled={items.length <= 1}
            className="mt-2 text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors text-sm"
            title="Remove item"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
      >
        + Add item
      </button>
    </div>
  )
}

interface ImageBlockProps {
  url: string
  alt: string
  caption: string | undefined
  storyId: string | undefined
  onChange: (fields: { url?: string; alt?: string; caption?: string }) => void
}

function ImageBlockInput({ url, alt, caption, storyId, onChange }: ImageBlockProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !storyId) return

    const fd = new FormData()
    fd.append('file', file)
    fd.append('storyId', storyId)
    fd.append('type', 'block')

    try {
      const res = await fetch('/api/admin/stories/upload-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (res.ok && json.url) onChange({ url: json.url })
      else alert(json.error ?? 'Upload failed')
    } catch {
      alert('Upload failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {/* URL field + upload button */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-yellow-500 transition-colors"
          placeholder="Image URL (or upload below)"
          value={url}
          onChange={e => onChange({ url: e.target.value })}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg
                     border border-gray-600 transition-colors"
        >
          Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Preview */}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt || 'preview'} className="rounded-lg max-h-48 object-cover border border-gray-700" />
      )}

      {/* Alt text */}
      <input
        type="text"
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm
                   focus:outline-none focus:border-yellow-500 transition-colors"
        placeholder="Alt text (required for accessibility)"
        value={alt}
        onChange={e => onChange({ alt: e.target.value })}
      />

      {/* Caption */}
      <input
        type="text"
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-400 text-sm
                   focus:outline-none focus:border-yellow-500 transition-colors"
        placeholder="Caption (optional)"
        value={caption ?? ''}
        onChange={e => onChange({ caption: e.target.value })}
      />
    </div>
  )
}

// ── Single block row ──────────────────────────────────────────────────────────

interface BlockRowProps {
  block:    Block
  index:    number
  total:    number
  storyId:  string | undefined
  onChange: (block: Block) => void
  onMove:   (direction: 'up' | 'down') => void
  onDelete: () => void
}

function BlockRow({ block, index, total, storyId, onChange, onMove, onDelete }: BlockRowProps) {
  function renderEditor() {
    switch (block.type) {
      case 'p':
      case 'h2':
      case 'h3':
        return (
          <TextBlockInput
            value={block.text}
            rows={block.type === 'p' ? 3 : 2}
            placeholder={BLOCK_LABELS[block.type]}
            onChange={text => onChange({ ...block, text })}
          />
        )
      case 'callout':
        return (
          <TextBlockInput
            value={block.text}
            rows={3}
            placeholder="Callout / final thoughts text…"
            onChange={text => onChange({ ...block, text })}
          />
        )
      case 'ol':
      case 'ul':
        return (
          <ListBlockInput
            items={block.items}
            onChange={items => onChange({ ...block, items })}
          />
        )
      case 'image':
        return (
          <ImageBlockInput
            url={block.url}
            alt={block.alt}
            caption={block.caption}
            storyId={storyId}
            onChange={fields => onChange({ ...block, ...fields } as Block)}
          />
        )
    }
  }

  const typeLabel = BLOCK_LABELS[block.type]
  const typeBg: Record<BlockType, string> = {
    p:       'bg-gray-700',
    h2:      'bg-purple-900/60',
    h3:      'bg-purple-900/40',
    ol:      'bg-blue-900/40',
    ul:      'bg-blue-900/30',
    callout: 'bg-yellow-900/40',
    image:   'bg-green-900/40',
  }

  return (
    <div className={`rounded-xl border border-gray-700 ${typeBg[block.type]} p-4`}>
      {/* Row header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          {typeLabel}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove('up')}
            className="p-1 text-gray-500 hover:text-white disabled:opacity-20 transition-colors text-sm"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove('down')}
            className="p-1 text-gray-500 hover:text-white disabled:opacity-20 transition-colors text-sm"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-gray-500 hover:text-red-400 transition-colors text-sm ml-1"
            title="Delete block"
          >
            ✕
          </button>
        </div>
      </div>

      {renderEditor()}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface StoryBlockEditorProps {
  blocks:   Block[]
  storyId?: string   // needed for in-block image uploads; undefined when creating new
  onChange: (blocks: Block[]) => void
}

export default function StoryBlockEditor({ blocks, storyId, onChange }: StoryBlockEditorProps) {
  function updateBlock(index: number, block: Block) {
    const next = [...blocks]
    next[index] = block
    onChange(next)
  }

  function deleteBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index))
  }

  function moveBlock(index: number, direction: 'up' | 'down') {
    const next = [...blocks]
    const swap = direction === 'up' ? index - 1 : index + 1
    ;[next[index], next[swap]] = [next[swap], next[index]]
    onChange(next)
  }

  function addBlock(type: BlockType) {
    onChange([...blocks, defaultBlock(type)])
  }

  const blockTypes: BlockType[] = ['p', 'h2', 'h3', 'ul', 'ol', 'callout', 'image']

  return (
    <div>
      <div className="space-y-3 mb-4">
        {blocks.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-6 border border-dashed border-gray-700 rounded-xl">
            No content blocks yet — add one below.
          </p>
        )}
        {blocks.map((block, i) => (
          <BlockRow
            key={i}
            block={block}
            index={i}
            total={blocks.length}
            storyId={storyId}
            onChange={b => updateBlock(i, b)}
            onMove={dir => moveBlock(i, dir)}
            onDelete={() => deleteBlock(i)}
          />
        ))}
      </div>

      {/* Add block toolbar */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-700">
        <span className="text-xs text-gray-500 self-center mr-1">Add block:</span>
        {blockTypes.map(type => (
          <button
            key={type}
            type="button"
            onClick={() => addBlock(type)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-yellow-500
                       text-white text-xs rounded-lg transition-colors"
          >
            {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  )
}
