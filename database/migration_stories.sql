-- ── Stories CMS ───────────────────────────────────────────────────────────────
-- A general-purpose article/story table for the Pokémon TCG news section.
-- Content is stored as a JSONB array of typed blocks (paragraphs, headings,
-- lists, callouts, images) so articles are read/written atomically without joins.
-- is_published defaults to true — no draft mode, every save is immediately live.

CREATE TABLE IF NOT EXISTS stories (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        UNIQUE NOT NULL,
  category        text        NOT NULL,        -- 'Value'|'Trivia'|'Sets'|'Art'|'Market'|'Competitive'
  category_icon   text        NOT NULL,
  title           text        NOT NULL,
  description     text        NOT NULL,
  gradient        text        NOT NULL,
  accent_colour   text        NOT NULL DEFAULT 'text-indigo-300',
  cover_image_url text,                        -- optional hero/card image (R2 CDN URL)
  content         jsonb       NOT NULL DEFAULT '[]',
  is_published    boolean     NOT NULL DEFAULT true,
  published_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS stories_published_at_idx
  ON stories (published_at DESC)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS stories_slug_idx ON stories (slug);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION stories_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION stories_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Public users can only read published stories
CREATE POLICY "stories_public_select"
  ON stories FOR SELECT
  USING (is_published = true);

-- Service-role (used by admin API routes) bypasses RLS automatically.
-- No explicit admin policy needed since API routes use supabaseAdmin (service key).

-- ── Seed: port existing static articles ──────────────────────────────────────

INSERT INTO stories (slug, category, category_icon, title, description, gradient, accent_colour, content, is_published, published_at)
VALUES

-- 1. Value ───────────────────────────────────────────────────────────────────
(
  'top-10-value',
  'Value',
  '💎',
  'Top 10 Most Valuable Pokémon Cards Right Now (2026)',
  'From ex to alt arts — these are the cards driving the market in 2026. Whether you are buying, selling or holding, here is where the value sits.',
  'linear-gradient(145deg, #2e1065 0%, #4c1d95 35%, #6d28d9 70%, #7c3aed 100%)',
  'text-purple-300',
  '[
    {"type":"p","text":"The Pokémon card market in 2026 is stronger than ever, with a mix of vintage grails and modern ultra-rares dominating the top end. While nostalgia continues to drive demand for early-era cards, newer releases have proven they can compete — especially in perfect condition."},
    {"type":"h2","text":"Top 10 most valuable cards"},
    {"type":"ol","items":["Pikachu Illustrator (1998) — Still the undisputed king. Awarded to winners of a Japanese illustration contest, this card remains the rarest and most iconic Pokémon card ever produced.","1st Edition Charizard (Base Set, Shadowless) — The face of the hobby. PSA 10 copies continue to break six-figure territory thanks to global demand.","Umbreon Gold Star (POP Series 5) — Extremely low pull rates and high popularity make this one of the most sought-after modern-era cards.","Trophy Kangaskhan (Family Event 1998) — A true collector''s piece with limited distribution, rarely seen on the market.","Rayquaza Gold Star (EX Deoxys) — A fan-favorite Pokémon combined with Gold Star rarity — a perfect storm for high value.","Lugia 1st Edition (Neo Genesis) — Known for its difficult grading, PSA 10 copies are incredibly scarce.","Mewtwo EX (Play Promo) — A unique promo with extremely limited availability, gaining traction among serious collectors.","Charizard EX (FireRed & LeafGreen) — A modern classic that continues to rise due to nostalgia and rarity.","Espeon Gold Star (POP Series 5) — Highly collectible due to both scarcity and Eeveelution popularity.","Giratina VSTAR (Crown Zenith Gold) — A newer entry proving modern cards can still hit high-value status when design and rarity align."]},
    {"type":"callout","text":"The market continues to reward rarity, condition, and iconic Pokémon. Whether you''re collecting or investing, understanding these top-tier cards gives you a clear picture of where the hobby is heading."}
  ]'::jsonb,
  true,
  now()
),

-- 2. Trivia ──────────────────────────────────────────────────────────────────
(
  'never-been-graded',
  'Trivia',
  '✨',
  'Pokémon Cards That Have Never Been Graded',
  'There are Pokémon cards that have never been officially graded — find out which ones and why they remain shrouded in mystery.',
  'linear-gradient(145deg, #78350f 0%, #b45309 40%, #d97706 75%, #f59e0b 100%)',
  'text-amber-300',
  '[
    {"type":"p","text":"Grading is a cornerstone of the Pokémon TCG world — but surprisingly, not every card has made it into a slab."},
    {"type":"p","text":"Some cards are so rare, obscure, or inaccessible that major grading companies like PSA and Beckett have never officially graded a single copy. These cards exist in a kind of \"mythical\" category among collectors."},
    {"type":"h2","text":"Why would a card never be graded?"},
    {"type":"ol","items":["Extreme scarcity — Some cards were printed in quantities so low that only a handful are known to exist, sometimes locked away in private collections.","Regional exclusivity — Certain promos were only distributed in small local events in Japan or never publicly released at all.","Ownership concentration — A single collector (or a small group) may own all known copies and choose not to grade them."]},
    {"type":"h2","text":"Notable examples"},
    {"type":"ul","items":["University Magikarp (1998) — awarded through a Japanese academic competition","No. 1 Trainer Trophy Cards (various years) — given only to top tournament winners","Snap Photo Contest Cards — personalized cards created from submitted photographs"]},
    {"type":"h2","text":"Why it matters"},
    {"type":"p","text":"Ungraded doesn''t mean less valuable — in fact, it often means the opposite. These cards represent the absolute edge of rarity in the hobby."},
    {"type":"callout","text":"For collectors, they''re not just cards — they''re pieces of Pokémon history that may never fully enter the public market."}
  ]'::jsonb,
  true,
  now()
),

-- 3. Sets ────────────────────────────────────────────────────────────────────
(
  'mega-evolution-whats-next',
  'Sets',
  '🔥',
  'Mega Evolution: What''s Coming Next?',
  'The upcoming expansion is set to shake up both the competitive and collector meta. Here is everything we know so far.',
  'linear-gradient(145deg, #164e63 0%, #0e7490 40%, #0891b2 75%, #22d3ee 100%)',
  'text-cyan-300',
  '[
    {"type":"p","text":"Mega Evolution is officially returning to the Pokémon TCG — and it could reshape both the competitive meta and collector landscape."},
    {"type":"p","text":"Originally introduced in the XY era, Mega Evolutions were known for their powerful effects and high-risk, high-reward gameplay. Now, they''re back with a modern twist."},
    {"type":"h2","text":"What we know so far"},
    {"type":"ul","items":["New Mega EX-style cards are expected, combining high HP with strong abilities","Updated mechanics may reduce previous drawbacks like ending your turn upon evolution","Fan-favorite Pokémon confirmed, including Mega Charizard, Mega Lucario, and Mega Gardevoir"]},
    {"type":"h2","text":"Competitive impact"},
    {"type":"p","text":"Mega Evolution cards are likely to become centerpieces of new deck archetypes. Their strength could shift the meta toward slower, more strategic gameplay built around evolution timing and resource management."},
    {"type":"h2","text":"Collector impact"},
    {"type":"p","text":"From a collector standpoint, this set has massive potential:"},
    {"type":"ul","items":["High-end alternate arts","Premium gold and textured cards","Strong nostalgia factor"]},
    {"type":"callout","text":"Whether you''re a player or collector, this is a set to watch closely. Early pulls and sealed products could see significant demand if hype continues to build."}
  ]'::jsonb,
  true,
  now()
),

-- 4. Art ─────────────────────────────────────────────────────────────────────
(
  'ken-sugimori-spotlight',
  'Art',
  '🎨',
  'Illustrator Spotlight: Ken Sugimori',
  'The legend behind the original 151 — Ken Sugimori''s rarest works are absolute collector holy grails.',
  'linear-gradient(145deg, #500724 0%, #9d174d 40%, #be185d 75%, #f472b6 100%)',
  'text-pink-300',
  '[
    {"type":"p","text":"Few names are as important to Pokémon as Ken Sugimori. As the original art director and lead illustrator, he defined the visual identity of the franchise from day one."},
    {"type":"h2","text":"The origin of a style"},
    {"type":"p","text":"Sugimori''s watercolor-inspired approach gave early Pokémon cards a soft, organic feel — very different from the digital-heavy styles seen today. His work on the original 151 Pokémon is instantly recognizable."},
    {"type":"h2","text":"Iconic cards"},
    {"type":"p","text":"Some of the most valuable and beloved cards feature his illustrations:"},
    {"type":"ul","items":["Base Set starters (Charizard, Blastoise, Venusaur)","Early promotional cards","Japanese-exclusive artworks"]},
    {"type":"h2","text":"Why collectors value his work"},
    {"type":"p","text":"Sugimori''s illustrations represent the foundation of Pokémon itself. For many collectors, owning his cards is like owning a piece of the franchise''s origin story."},
    {"type":"h2","text":"Legacy"},
    {"type":"callout","text":"Even today, his influence can be seen across modern sets. While new artists have expanded the style, Sugimori''s original vision remains at the core of Pokémon''s identity."}
  ]'::jsonb,
  true,
  now()
),

-- 5. Market ──────────────────────────────────────────────────────────────────
(
  'price-movers-this-week',
  'Market',
  '📈',
  'Biggest Price Movers This Week',
  'Seven cards that moved significantly in value over the last seven days — and the stories behind each spike.',
  'linear-gradient(145deg, #064e3b 0%, #065f46 40%, #047857 75%, #10b981 100%)',
  'text-emerald-300',
  '[
    {"type":"p","text":"The Pokémon card market never stands still — and this week delivered some major surprises."},
    {"type":"h2","text":"📊 Top gainers"},
    {"type":"ul","items":["Umbreon VMAX (Evolving Skies, Alt Art) — +18% — Continued demand and low supply are pushing this card higher again.","Giratina VSTAR (Crown Zenith Gold) — +12% — Gold cards remain hot among collectors.","Charizard ex (Obsidian Flames, Special Art) — +9% — Renewed interest after recent tournament visibility."]},
    {"type":"h2","text":"📉 Biggest drops"},
    {"type":"ul","items":["Mewtwo VSTAR (Pokémon GO set) — -10% — Oversupply continues to impact pricing.","Arceus VSTAR (Brilliant Stars) — -7% — Meta relevance declining slightly."]},
    {"type":"h2","text":"What''s driving the market?"},
    {"type":"ul","items":["Tournament results","Influencer hype","Supply entering the market","Grading population increases"]},
    {"type":"callout","text":"Short-term movement can create opportunities — but long-term value still depends on rarity, condition, and iconic status."}
  ]'::jsonb,
  true,
  now()
),

-- 6. Competitive ─────────────────────────────────────────────────────────────
(
  'regional-championship-results',
  'Competitive',
  '🏆',
  'Regional Championship Results',
  'Breakdown of the winning decks, standout cards and meta shifts from the latest Regional Championship.',
  'linear-gradient(145deg, #1c1917 0%, #44403c 40%, #78716c 75%, #a8a29e 100%)',
  'text-stone-300',
  '[
    {"type":"p","text":"The latest Regional Championship has wrapped up — and the results are already shaping the competitive meta."},
    {"type":"h2","text":"🥇 Winning deck: Lost Zone Box"},
    {"type":"p","text":"A flexible and consistent deck that continues to perform at the highest level. Its ability to adapt mid-game gives it a strong edge in diverse matchups."},
    {"type":"h2","text":"🥈 Runner-up: Charizard ex"},
    {"type":"p","text":"A powerful deck built around high damage output and energy acceleration. Still one of the most popular choices among top players."},
    {"type":"h2","text":"🥉 Top contenders"},
    {"type":"ul","items":["Gardevoir ex — strong late-game scaling","Miraidon ex — fast and aggressive playstyle","Lugia VSTAR — consistent setup and energy control"]},
    {"type":"h2","text":"Key takeaways"},
    {"type":"ul","items":["The meta is stabilizing around a few core archetypes","Consistency is more important than raw power","Tech cards are becoming increasingly important"]},
    {"type":"callout","text":"If you''re building decks or tracking card values, these results matter. Competitive success often drives demand — and prices tend to follow."}
  ]'::jsonb,
  true,
  now()
)

ON CONFLICT (slug) DO NOTHING;
