# Holo & Reverse-Holo Effect Fix Plan

## Problems

### 1. Reverse-holo mask silently broken (critical)
`reverseHoloMaskStyle` in `CardGlareImage` uses a two-layer CSS mask with
`WebkitMaskComposite: 'destination-out'` / `maskComposite: 'subtract'` to punch a
rectangular hole in the overlay (hiding the inner artwork area so the shimmer only
appears on the card border/background). This technique has inconsistent browser
support — the composite step is silently ignored in many browsers, leaving the
rainbow covering the **entire** card surface.

### 2. Effect alpha / saturation too intense
Both `holo` and `reverse-holo` use `hsla(hue, 100%, 60%, 0.75)` with
`mix-blend-mode: screen`. 100% saturation + 0.75 alpha on screen produces a
blinding neon rainbow. Real foil cards show a much more subtle iridescence
(~35-45% alpha, lower saturation).

### 3. Mouse-leave permanently hides base holo
`handleMouseLeave` unconditionally sets `holoRef.current.style.opacity = '0'`.
Cards whose default variant is Holo Rare / Reverse Holo should keep a resting
low-opacity shimmer even when the cursor is not over the card. Currently the
shimmer disappears on mouse-leave and can only be restored if `holoEffect`
changes value (triggering the `useEffect([holoEffect])` dependency).

### 4. Holo clip-path insets slightly off for standard cards
`clipPath: 'inset(12% 9% 8% 9% round 4px)'` leaves only 8% at the bottom, but
a standard Pokémon card has 40%+ of its height occupied by the attack/weakness
text boxes below the artwork. The top inset of 12% also clips into the name/HP
bar slightly too soon (should be ~16%).

---

## Fix Plan (all changes in `components/CardGrid.tsx` — `CardGlareImage` only)

### Fix 1 — Replace CSS mask-composite with SVG data-URI mask

**File**: `components/CardGrid.tsx` lines 226-239

Replace `reverseHoloMaskStyle` with an SVG inline mask. SVG masks work in all
modern browsers. The SVG uses a 0-100 coordinate viewBox with
`preserveAspectRatio="none"` so it stretches to exact card dimensions:
- Outer `<rect width="100" height="100" fill="white"/>` = show everywhere
- Inner `<rect x="9" y="12" width="82" height="80" rx="1.5" fill="black"/>` = hide inner frame

#### Corrected inner-frame coordinates (artwork-box-only cutout)

The original code tried to hide the *entire* inner frame (name bar, attacks, text boxes —
everything inside the colored border). That is not how real reverse-holo foil works.

On a real reverse-holo card the foil is the **card background layer** — it shimmers
through the name plate, the attack rows, the type icons, and the outer border, but
**not** through the solid artwork photograph box.

The mask's black rect should therefore only cut out the **artwork photo**, keeping
shimmer visible everywhere else.

Standard-frame card proportions at 389 × 543 px:
```
  Name / HP / evolves bar   0 – 16%  (0 – 87 px)
  Artwork photo box        16 – 53%  (87 – 288 px)  → height = 37%
  Attacks / text / footer  53 – 100% (288 – 543 px)

  Left card margin          0 – 7.5% (0 – 29 px)
  Artwork / content        7.5 – 92.5%               → width = 85%
  Right card margin       92.5 – 100%
```

SVG black rect (hide shimmer inside artwork box only):
**`x=7.5, y=16, width=85, height=37, rx=2`**

This keeps shimmer visible on:
- Outer colored border strip (left / right / top / bottom)
- Name and HP bar
- Attack text rows, type icons, Pokémon rule box
- Weakness / Resistance / Retreat bar

And hides shimmer on:
- The illustration photograph only

```typescript
const svgMask = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
  `<rect width="100" height="100" fill="white"/>` +
  `<rect x="7.5" y="16" width="85" height="37" rx="2" fill="black"/>` +
  `</svg>`
)
const reverseHoloMaskStyle: React.CSSProperties = {
  WebkitMaskImage: `url("data:image/svg+xml,${svgMask}")`,
  maskImage:       `url("data:image/svg+xml,${svgMask}")`,
  WebkitMaskSize:  '100% 100%',
  maskSize:        '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat:       'no-repeat',
}
```

Remove all the old `WebkitMaskComposite`, `maskComposite`, `WebkitMaskPosition`,
`maskPosition` properties.

---

### Fix 2 — Lower effect alpha and saturation

**File**: `components/CardGrid.tsx` — two locations where `h()` is defined

Change the color helper from:
```typescript
const h = (off: number) => `hsla(${(hue + off) % 360}, 100%, 60%, 0.75)`
```
to:
```typescript
const h = (off: number) => `hsla(${(hue + off) % 360}, 80%, 65%, 0.40)`
```

This applies to both:
- Line ~150 (static `useEffect` that shows a centred rainbow on hover-enter)
- Line ~196 (RAF mouse-move handler)

Rationale: 80% saturation + 40% alpha produces a pearlescent foil shimmer
rather than a neon paint-stroke. The `mix-blend-mode: screen` amplifies it
further on bright card areas.

---

### Fix 3 — Restore base holo at resting opacity on mouse-leave

**File**: `components/CardGrid.tsx` lines 206-213

Change `handleMouseLeave` to leave the holo layer at a low resting opacity
(0.25) instead of fully hiding it, when `holoEffectRef.current` is non-null:

```typescript
const handleMouseLeave = () => {
  if (rafRef.current) cancelAnimationFrame(rafRef.current)
  if (!cardRef.current || !glareRef.current) return
  cardRef.current.style.transition = 'transform 600ms cubic-bezier(0.16,1,0.3,1)'
  cardRef.current.style.transform  = 'perspective(800px) rotateX(0deg) rotateY(0deg)'
  glareRef.current.style.opacity   = '0'
  if (holoRef.current) {
    // Keep a gentle resting glow if a holo effect is active;
    // fully hide only when there is no current effect.
    holoRef.current.style.opacity = holoEffectRef.current ? '0.25' : '0'
  }
}
```

Also update the static `useEffect([holoEffect])` initial-show gradient to use
the same reduced alpha so there is no jump between resting state and hover state:

```typescript
useEffect(() => {
  if (!holoRef.current) return
  if (holoEffect) {
    const h = (off: number) => `hsla(${off % 360}, 80%, 65%, 0.40)`
    holoRef.current.style.backgroundImage =
      `linear-gradient(135deg,${h(0)} 0%,${h(60)} 17%,${h(120)} 34%,` +
      `${h(180)} 51%,${h(240)} 68%,${h(300)} 85%,${h(360)} 100%)`
    holoRef.current.style.opacity = '0.25'   // resting state; mouse-move will raise to 1
  } else {
    holoRef.current.style.opacity = '0'
  }
}, [holoEffect])
```

---

### Fix 4 — Adjust holo clip-path for standard card artwork area

**File**: `components/CardGrid.tsx` line 241

Change:
```typescript
const holoMaskStyle: React.CSSProperties = {
  clipPath: 'inset(12% 9% 8% 9% round 4px)',
}
```
to (standard frame — see Fix 5 for full-art override):
```typescript
const holoMaskStyle: React.CSSProperties = isFullArt
  ? { clipPath: 'inset(1% 1% 1% 1% round 8px)' }
  : { clipPath: 'inset(16% 8% 42% 8% round 3px)' }
```

Standard-frame rationale:
- Top 16%: clear of name bar, HP, evolves-from lines
- Left/right 8%: card border strip
- Bottom 42%: clears the text box (ability, attacks, weakness row)

---

### Fix 5 — Full-art card detection (no artwork-window clip for holo)

Full-art / special illustration cards (Rare Ultra, Rainbow Rare, Special Illustration
Rare, etc.) have artwork that fills or nearly fills the entire card face. Clipping the
shimmer to the inner artwork window looks wrong for these — the shimmer should cover
the whole card.

`PokemonCard.rarity` is already in [`types/index.ts`](../types/index.ts:100) and
available on `selectedCard` in the modal. No DB schema change needed.

#### New helper (add near `getHoloEffect`, ~line 1098)

```typescript
// Returns true for special-print rarities where the artwork fills
// the whole card face (Full Art, Rainbow, Special Illustration, etc.).
function isFullArtRarity(rarity: string | null | undefined): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return (
    r.includes('rare ultra')           ||  // Full Art EX / GX / V / VMAX
    r.includes('rare rainbow')         ||  // Rainbow Rare (older naming)
    r.includes('rare secret')          ||  // Secret Rare
    r.includes('special illustration') ||  // Special Illustration Rare (SIR)
    r.includes('illustration rare')    ||  // Illustration Rare (IR)
    r.includes('hyper rare')               // Hyper Rare / ACE SPEC ultra
  )
}
```

#### Add `isFullArt` prop to `CardGlareImage`

```typescript
function CardGlareImage({
  src,
  variantSrc,
  holoEffect,
  isFullArt,   // ← new
  alt,
}: {
  src: string | null | undefined
  variantSrc?: string | null
  holoEffect?: 'reverse-holo' | 'holo' | null
  isFullArt?: boolean          // ← new
  alt?: string
})
```

#### Pass the prop at the call site (~line 1298)

```typescript
<CardGlareImage
  src={selectedCard.image_url}
  variantSrc={variantImageSrc}
  holoEffect={holoEffect}
  isFullArt={isFullArtRarity(selectedCard.rarity)}
  alt={selectedCard.name ?? undefined}
/>
```

---

## Files Changed

| File | Scope |
|------|-------|
| `components/CardGrid.tsx` | `CardGlareImage` props + body; new `isFullArtRarity` helper; call site |

No new files, no API changes, no database changes.

---

## Visual Before / After

| Scenario | Before | After |
|----------|--------|-------|
| Reverse Holo (Roserade) | Rainbow covers full card incl. artwork | Rainbow on border strip only; artwork area clear |
| Holo standard card | Clip to inner frame (slightly off) | Clip to artwork window only (16%/8%/42%/8%) |
| Holo full-art EX (Yanmega) | Blinding neon full-card flash | Subtle pearlescent shimmer across full card face |
| Base holo card, mouse off card | Shimmer disappears | Gentle resting glow (opacity 0.25) |
| Mouse moves over card | Vivid 0.75 alpha | Responsive 0.40 alpha gradient |
