# Stories CMS — Implementation Plan

## Overview

Move from static `data/stories.ts` to a Supabase-backed CMS with a full admin editor, R2 image storage, and live public pages. 15 files total (11 new, 4 updated).

## Database: `stories` table

```sql
CREATE TABLE stories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  category        text NOT NULL,  -- 'Value' | 'Trivia' | 'Sets' | 'Art' | 'Market' | 'Competitive'
  category_icon   text NOT NULL,
  title           text NOT NULL,
  description     text NOT NULL,
  gradient        text NOT NULL,
  accent_colour   text NOT NULL,
  cover_image_url text,           -- optional card/hero image (R2 CDN URL)
  content         jsonb NOT NULL DEFAULT '[]',
  is_published    boolean NOT NULL DEFAULT true,  -- always live, no draft mode
  published_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

RLS: Public SELECT allowed when is_published = true. All mutations admin-only via service role API routes.
Migration also seeds all 6 existing articles from data/stories.ts.

## Block Type (with image support)

```typescript
type Block =
  | { type: 'p';       text: string }
  | { type: 'h2';      text: string }
  | { type: 'h3';      text: string }
  | { type: 'ol';      items: string[] }
  | { type: 'ul';      items: string[] }
  | { type: 'callout'; text: string }
  | { type: 'image';   url: string; alt: string; caption?: string }
```

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/stories` | GET | Public | All published stories, `?limit=N` supported |
| `/api/stories/[slug]` | GET | Public | Single published story by slug |
| `/api/admin/stories` | GET | Admin | All stories |
| `/api/admin/stories` | POST | Admin | Create new story (is_published=true) |
| `/api/admin/stories/[id]` | PATCH | Admin | Update story |
| `/api/admin/stories/[id]` | DELETE | Admin | Delete story |
| `/api/admin/stories/upload-image` | POST | Admin | Upload image → R2, returns `{ url }` |

## R2 Image Storage

Images go to: `story-images/{storyId}/{timestamp}-{filename}.webp`
Compressed via existing `compressImageToWebP()` from `lib/imageCompress.ts`.

## Gradient Presets (6 fixed swatches)

| Category | Gradient |
|----------|----------|
| Value 💎 | `linear-gradient(145deg, #2e1065 0%, #4c1d95 35%, #6d28d9 70%, #7c3aed 100%)` |
| Trivia ✨ | `linear-gradient(145deg, #78350f 0%, #b45309 40%, #d97706 75%, #f59e0b 100%)` |
| Sets 🔥 | `linear-gradient(145deg, #164e63 0%, #0e7490 40%, #0891b2 75%, #22d3ee 100%)` |
| Art 🎨 | `linear-gradient(145deg, #500724 0%, #9d174d 40%, #be185d 75%, #f472b6 100%)` |
| Market 📈 | `linear-gradient(145deg, #064e3b 0%, #065f46 40%, #047857 75%, #10b981 100%)` |
| Competitive 🏆 | `linear-gradient(145deg, #1c1917 0%, #44403c 40%, #78716c 75%, #a8a29e 100%)` |

## Files To Create/Update

### New files (11)
1. `database/migration_stories.sql`
2. `app/api/stories/route.ts`
3. `app/api/stories/[slug]/route.ts`
4. `app/api/admin/stories/route.ts`
5. `app/api/admin/stories/[id]/route.ts`
6. `app/api/admin/stories/upload-image/route.ts`
7. `components/admin/StoryBlockEditor.tsx`
8. `components/admin/StoryEditor.tsx`
9. `app/admin/stories/page.tsx`
10. `app/admin/stories/new/page.tsx`
11. `app/admin/stories/[id]/edit/page.tsx`

### Updated files (4)
1. `app/admin/page.tsx` — add Stories CMS tool card
2. `app/news/page.tsx` — fetch from /api/stories
3. `app/news/[slug]/page.tsx` — fetch from /api/stories/[slug]
4. `components/dashboard/NewsStories.tsx` — fetch from /api/stories?limit=4

## Key Decisions
- `is_published` defaults to `true` — no draft mode, all saves are immediately live
- JSONB content column — blocks read/written atomically with story, no join needed
- 6 fixed gradient presets — consistent visual identity across weekly editions
- Image blocks + cover_image_url use R2 CDN URLs
- Admin auth uses existing `requireAdmin()` from `lib/admin.ts`
