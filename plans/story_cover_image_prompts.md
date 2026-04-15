# Story Cover Image Prompts

> These images render at **25–30% opacity** over a CSS gradient overlay with dark text at the bottom.
> Best results: high contrast, strong silhouettes, dark/moody backgrounds, square or near-square crop (800×800px minimum).
> Upload via the admin story editor → cover image field.

---

## 💎 Value — "Top 10 Most Valuable Pokémon Cards Right Now"
**Gradient:** deep purple `#2e1065 → #7c3aed`

### Midjourney prompt
```
A dramatic close-up of a PSA graded trading card slab resting on a dark velvet surface, surrounded by scattered holographic trading cards with rainbow light refractions, moody studio lighting, deep purple and violet color tones, bokeh background, luxury aesthetic, photorealistic, 8K --ar 1:1 --style raw --v 6
```

### DALL-E prompt
```
A dramatic close-up photograph of a graded trading card slab on dark velvet fabric, surrounded by holographic trading cards showing rainbow prismatic light. Deep purple and violet lighting. Luxury, moody atmosphere. Studio product photography. Square format.
```

### Alt (simpler, more abstract)
```
Scattered holographic trading cards on a dark surface with dramatic purple and violet light refractions, close-up macro photography, bokeh blur, gemstone and prism reflections, luxury dark aesthetic, square composition, photorealistic --ar 1:1 --v 6
```

---

## ✨ Trivia — "Pokémon Cards That Have Never Been Graded"
**Gradient:** amber/orange `#78350f → #f59e0b`

### Midjourney prompt
```
An old rare trading card held in a gloved hand against a dark moody background, warm candlelight and amber glow, mysterious vintage atmosphere, dust particles in light, sepia and gold tones, shallow depth of field, cinematic, photorealistic, 8K --ar 1:1 --style raw --v 6
```

### DALL-E prompt
```
Close-up photograph of a rare vintage trading card held carefully in a hand, against a very dark background. Warm amber candlelight illuminating the card. Mysterious, antiquarian atmosphere. Gold and brown tones. Shallow depth of field. Cinematic photography. Square format.
```

### Alt (texture-focused)
```
Macro close-up of an old worn trading card surface with visible texture, scratches, and age, warm amber and orange backlighting shining through the card, dark background, mysterious and rare, museum artifact aesthetic, photorealistic --ar 1:1 --v 6
```

---

## 📈 Market — "Biggest Price Movers This Week"
**Gradient:** emerald green `#064e3b → #10b981`

### Midjourney prompt
```
A glowing green stock market chart with an upward trending line, displayed on a dark trading terminal screen, surrounded by floating price numbers and ticker symbols, dramatic upward momentum, dark background with emerald green neon glow, financial data visualization, cinematic, 8K --ar 1:1 --style raw --v 6
```

### DALL-E prompt
```
A glowing green upward trending stock chart on a dark screen. Floating price numbers and financial ticker data around it. Dark background. Emerald and bright green neon colors. Dramatic upward momentum. Cinematic financial data visualization. Square format.
```

### Alt (more abstract)
```
Abstract glowing green price graph lines rising dramatically on a pitch black background, emerald green neon light trails, financial momentum upward arrow, data visualization aesthetic, dark moody atmosphere, photorealistic render --ar 1:1 --v 6
```

---

## 🏆 Competitive — "Regional Championship Results"
**Gradient:** stone/charcoal `#1c1917 → #a8a29e`

### Midjourney prompt
```
A gleaming tournament trophy dramatically lit with a single spotlight on a dark stage, smoke and atmosphere in the background, championship event setting, competitive gaming or trading card tournament aesthetic, cinematic lighting, silver and white tones, epic composition, photorealistic, 8K --ar 1:1 --style raw --v 6
```

### DALL-E prompt
```
A gleaming trophy dramatically illuminated by a spotlight on a dark stage. Atmospheric smoke in the background. Championship tournament setting. Cinematic lighting. Silver, gold and white tones against a very dark background. Epic, aspirational composition. Square format.
```

### Alt (crowd/arena angle)
```
Aerial view of a competitive trading card game tournament, players seated at tables under dramatic overhead lighting, dark arena setting, championship banners, cinematic wide angle, cool silver and grey tones, photorealistic 8K --ar 1:1 --v 6
```

---

## Upload Instructions

1. Generate your preferred image at **1024×1024px** or larger
2. Save as `.jpg` or `.webp` for smaller file size
3. Go to **Admin → Stories → [Story Name] → Edit**
4. Upload via the cover image field — the API route `POST /api/admin/stories/upload-image` handles R2 storage automatically
5. The image will appear at **25% opacity** (dashboard cards) or **30% opacity** (news page cards) layered over the gradient

## Tips for Best Results

- **Re-roll with dark backgrounds** — the gradient needs to show through, so avoid images with white/very light backgrounds
- **High contrast silhouettes** look best through the opacity layer
- **Avoid text in the image** — it will blur and conflict with the story title overlay
- If the image feels too "busy", the opacity system handles it gracefully — prefer more texture over less
