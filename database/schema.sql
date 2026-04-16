-- ============================================================
-- Lumidex – Current Database Schema
-- Last updated: 2026-04-16
-- Generated from: live Supabase database introspection
-- Project ref: ysvskytxewtlxpxeiskf
-- ============================================================
--
-- Tables (in dependency order):
--   sets, cards*, variants*, users, achievements,
--   ebay_oauth_tokens, ebay_webhooks, set_products,
--   card_prices, card_price_history, card_graded_prices,
--   card_variant_availability, card_variant_images,
--   card_cm_url_overrides, price_points,
--   friendships, wanted_cards,
--   user_achievements, user_card_variants, user_cards,
--   user_card_activity_log, user_sets, user_sealed_products,
--   user_graded_cards, user_card_lists, user_card_list_items,
--   trade_proposals, trade_proposal_items, variant_suggestions,
--   stories, user_subscriptions
--
-- * cards ↔ variants have a circular FK:
--     cards.default_variant_id → variants.id  (added via ALTER TABLE below)
--     variants.card_id         → cards.id
-- ============================================================


-- ── TABLES ───────────────────────────────────────────────────

-- Sets
-- NOTE: primary key is set_id (text), not a UUID.
--       setTotal    = cards excluding secret rares.
--       setComplete = cards including secret rares.
create table if not exists public.sets (
    set_id                text        primary key,
    name                  text        not null,
    series                text,
    "setTotal"            integer,
    release_date          date,
    created_at            timestamp   default now(),
    "setComplete"         integer,
    logo_url              text,
    symbol_url            text,
    language              text        not null default 'en',
    prices_last_synced_at timestamptz,
    api_set_id            text
);

-- Cards
-- NOTE: id is a UUID (gen_random_uuid()).
--       set_id is a text FK referencing sets.set_id.
--       subtypes is a text[] array (e.g. {"Stage 1","Pokémon"}).
--       source_card_id: nullable self-FK. Used for reprint/Prize-Pack sets so they
--         inherit the source card's image without re-uploading.
--       default_variant_id: nullable FK to variants.id (added via ALTER TABLE below
--         to break the circular dependency).
--       api_id: unique external API identifier (nullable; unique WHERE NOT NULL).
create table if not exists public.cards (
    id                 uuid        not null default gen_random_uuid() primary key,
    set_id             text        not null references public.sets(set_id) on delete cascade,
    name               text        not null,
    number             text,
    rarity             text,
    type               text,           -- element type, e.g. "Grass", "Fire"
    created_at         timestamp   default now(),
    artist             text,
    image              text,           -- card's own uploaded image URL
    hp                 text,
    supertype          text,           -- e.g. "Pokémon", "Trainer", "Energy"
    subtypes           text[],         -- e.g. '{"Stage 1","Pokémon"}'
    default_variant_id uuid,           -- FK → variants.id ON DELETE SET NULL (added below)
    api_id             text,           -- unique external API card ID
    source_card_id     uuid        references public.cards(id) on delete set null,
    tcggo_id           integer         -- tcggo.com / cardmarket-api-tcg RapidAPI internal card ID; populated during episode price sync
);

-- Variants (global catalog of card variant types)
-- NOTE: card_id is nullable. NULL = global variant (applies to all cards).
--       Non-null card_id = card-specific variant.
--       key must be globally unique across all variants.
create table if not exists public.variants (
    id           uuid        not null default gen_random_uuid() primary key,
    variant_type text,                 -- legacy column
    created_at   timestamp   default now(),
    name         text        not null,
    key          text        not null,
    description  text,
    color        text        not null default 'gray'
                   check (color in ('green','blue','purple','red','pink','yellow','gray','orange','teal')),
    short_label  text,
    is_quick_add boolean     not null default false,
    sort_order   integer     not null default 0,
    is_official  boolean     not null default true,
    created_by   uuid,                 -- FK → users.id (nullable)
    card_id      uuid        references public.cards(id) on delete cascade,
    constraint variants_key_unique unique (key)
);

-- Resolve the circular FK: cards.default_variant_id → variants.id
do $$
begin
    if not exists (
        select 1 from information_schema.table_constraints
        where constraint_name = 'cards_default_variant_id_fkey'
          and table_schema = 'public'
    ) then
        alter table public.cards
            add constraint cards_default_variant_id_fkey
            foreign key (default_variant_id)
            references public.variants(id)
            on delete set null;
    end if;
end;
$$;

-- Users (extends auth.users)
-- NOTE: id references auth.users.id (auth schema FK, ON DELETE CASCADE).
--       profile preferences (language, currency, price_source, etc.) are stored here.
create table if not exists public.users (
    id                     uuid        primary key references auth.users(id) on delete cascade,
    username               text        unique,
    email                  text,
    avatar_url             text,
    created_at             timestamp   default now(),
    role                   text        not null default 'user'
                               check (role in ('user','admin')),
    display_name           text,
    banner_url             text,
    bio                    text,
    location               text,
    setup_completed        boolean     not null default false,
    preferred_language     text        not null default 'en',
    preferred_currency     text        not null default 'USD',
    price_source           text        not null default 'tcgplayer'
                               check (price_source in ('tcgplayer','cardmarket')),
    grey_out_unowned       boolean     not null default true,
    profile_private        boolean     not null default false,
    show_portfolio_value   text        not null default 'public'
                               check (show_portfolio_value in ('public','friends_only','private')),
    lists_public_by_default boolean    not null default false,
    social_cardmarket      text,
    social_instagram       text,
    social_facebook        text
);

-- Achievements
create table if not exists public.achievements (
    id          uuid        not null default gen_random_uuid() primary key,
    name        text        not null unique,
    description text        not null,
    icon        text        not null,
    created_at  timestamptz not null default timezone('utc'::text, now())
);

-- eBay OAuth token cache
-- Single-row table keyed on 'client_credentials'. Survives serverless cold starts.
create table if not exists public.ebay_oauth_tokens (
    token_key    text        primary key,   -- always 'client_credentials'
    access_token text        not null,
    expires_at   timestamptz not null,
    updated_at   timestamptz not null default now()
);

-- eBay webhook event log
-- Raw payloads from eBay Marketplace Account Deletion / notification subscriptions.
-- Written server-side via service role only.
create table if not exists public.ebay_webhooks (
    id         uuid        not null default gen_random_uuid() primary key,
    payload    jsonb,
    created_at timestamp   default now()
);

-- Set products (sealed product catalog per set)
-- NOTE: set_id is a text reference to sets.set_id (no FK enforced at DB level).
--       api_product_id is the external API product identifier (unique).
--       image_url is the product box image.
create table if not exists public.set_products (
    id             uuid        not null default gen_random_uuid() primary key,
    set_id         text        not null,    -- text ref → sets.set_id (no FK)
    api_product_id text        unique,
    name           text        not null,
    product_type   text,
    tcgp_market    numeric,
    tcgp_low       numeric,
    tcgp_high      numeric,
    tcgp_url       text,
    cm_avg_sell    numeric,
    cm_trend       numeric,
    cm_url         text,
    fetched_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    image_url      text
);

-- Card prices (latest prices per card, one row per card)
-- NOTE: card_id has a UNIQUE constraint (one price row per card).
create table if not exists public.card_prices (
    id                uuid        not null default gen_random_uuid() primary key,
    card_id           uuid        not null unique references public.cards(id) on delete cascade,
    tcgp_normal       numeric,
    tcgp_reverse_holo numeric,
    tcgp_holo         numeric,
    tcgp_1st_edition  numeric,
    tcgp_market       numeric,
    tcgp_psa10        numeric,
    tcgp_psa9         numeric,
    tcgp_bgs95        numeric,
    tcgp_bgs9         numeric,
    tcgp_cgc10        numeric,
    cm_avg_sell       numeric,
    cm_low            numeric,
    cm_trend          numeric,
    cm_avg_30d        numeric,
    api_card_id       text,
    tcgp_updated_at   text,
    cm_updated_at     text,
    fetched_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    cm_reverse_holo   numeric,
    cm_url            text,
    cm_cosmos_holo    numeric
);

-- Card price history (time-series price records)
create table if not exists public.card_price_history (
    id              uuid        not null default gen_random_uuid() primary key,
    card_id         uuid        not null references public.cards(id) on delete cascade,
    variant_key     text        not null,
    price_usd       numeric     not null,
    source          text        not null default 'tcgplayer',
    recorded_at     timestamptz not null default now(),
    is_graded       boolean     not null default false,
    grade           numeric,
    grading_company text
);

-- Card graded prices (latest graded prices per card+company+grade combo)
-- NOTE: unique on (card_id, grading_company, grade).
create table if not exists public.card_graded_prices (
    id              uuid        not null default gen_random_uuid() primary key,
    card_id         uuid        not null references public.cards(id) on delete cascade,
    grading_company text        not null check (grading_company in ('PSA','CGC','ACE')),
    grade           integer     not null check (grade >= 1 and grade <= 10),
    avg_price_usd   numeric     not null,
    sample_size     integer     not null default 1,
    fetched_at      timestamptz not null default now(),
    constraint card_graded_prices_unique unique (card_id, grading_company, grade)
);

-- Card variant availability (which variants are available for a given card)
-- NOTE: created_by may reference auth.users (no public FK enforced).
create table if not exists public.card_variant_availability (
    id         uuid        not null default gen_random_uuid() primary key,
    card_id    uuid        not null references public.cards(id) on delete cascade,
    variant_id uuid        not null references public.variants(id) on delete cascade,
    created_by uuid,       -- optional ref to auth.users
    created_at timestamptz default now(),
    constraint unique_card_variant unique (card_id, variant_id)
);

-- Card variant images (custom images per card+variant combo)
-- NOTE: created_by may reference auth.users (no public FK enforced).
create table if not exists public.card_variant_images (
    id         uuid        not null default gen_random_uuid() primary key,
    card_id    uuid        not null references public.cards(id) on delete cascade,
    variant_id uuid        not null references public.variants(id) on delete cascade,
    image_url  text        not null,
    created_by uuid,       -- optional ref to auth.users
    created_at timestamptz not null default now(),
    constraint unique_card_variant_image unique (card_id, variant_id)
);

-- Card CardMarket URL overrides (manual cm_url overrides per card+variant)
create table if not exists public.card_cm_url_overrides (
    id          uuid        not null default gen_random_uuid() primary key,
    card_id     uuid        not null references public.cards(id) on delete cascade,
    variant_key text        not null,
    cm_url      text        not null,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),
    constraint unique_card_variant_cmurl unique (card_id, variant_key)
);

-- Price points (granular price observations from multiple sources)
create table if not exists public.price_points (
    id              uuid        not null default gen_random_uuid() primary key,
    card_id         uuid        not null references public.cards(id) on delete cascade,
    source          text        not null check (source in ('tcgplayer','cardmarket','ebay')),
    variant_key     text,
    price           numeric     not null,
    currency        text        not null default 'USD',
    condition       text,
    is_graded       boolean     not null default false,
    grade           numeric,
    grading_company text,
    recorded_at     timestamptz not null default now()
);

-- Friendships
-- NOTE: unique on (requester_id, addressee_id) — ordered pair.
--       status: 'pending' | 'accepted' | 'declined' | 'blocked'
create table if not exists public.friendships (
    id           uuid        not null default gen_random_uuid() primary key,
    requester_id uuid        not null references public.users(id) on delete cascade,
    addressee_id uuid        not null references public.users(id) on delete cascade,
    status       text        not null default 'pending'
                     check (status in ('pending','accepted','declined','blocked')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint friendships_pair_key unique (requester_id, addressee_id),
    constraint friendships_no_self  check (requester_id <> addressee_id)
);

-- Wanted cards (user wishlist)
create table if not exists public.wanted_cards (
    id         uuid        not null default gen_random_uuid() primary key,
    user_id    uuid        not null references public.users(id) on delete cascade,
    card_id    uuid        not null references public.cards(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint wanted_cards_user_card_key unique (user_id, card_id)
);

-- User achievements
create table if not exists public.user_achievements (
    id             uuid        not null default gen_random_uuid() primary key,
    user_id        uuid        not null references public.users(id),         -- no cascade
    achievement_id uuid        not null references public.achievements(id) on delete cascade,
    unlocked_at    timestamptz not null default timezone('utc'::text, now()),
    constraint user_achievements_user_id_achievement_id_key unique (user_id, achievement_id)
);

-- User-owned card variants (primary collection tracking table)
-- NOTE: card_id and variant_id are uuid FKs (cascade on delete).
--       variant_type is a legacy text column kept alongside variant_id.
--       quantity_delta holds the last change increment (for activity logging).
create table if not exists public.user_card_variants (
    id             uuid        not null default gen_random_uuid() primary key,
    user_id        uuid        references public.users(id) on delete cascade,
    card_id        uuid        references public.cards(id) on delete cascade,
    variant_type   text,                -- legacy column
    created_at     timestamp   default now(),
    variant_id     uuid        references public.variants(id) on delete cascade,
    quantity       integer     default 0,
    updated_at     timestamp   default now(),
    quantity_delta integer,             -- last increment/decrement applied
    constraint user_card_variants_unique unique (user_id, card_id, variant_id)
);

-- User cards (legacy — quantity mirrors sum in user_card_variants for backwards compat.)
create table if not exists public.user_cards (
    id         uuid        not null default gen_random_uuid() primary key,
    user_id    uuid        references public.users(id),         -- no cascade on user
    card_id    uuid        references public.cards(id) on delete cascade,
    created_at timestamp   default now(),
    quantity   integer     not null default 0,
    constraint user_cards_user_id_card_id_key unique (user_id, card_id)
);

-- User card activity log (audit log of quantity changes)
-- NOTE: no FK constraints enforced at DB level — logged by application.
create table if not exists public.user_card_activity_log (
    id           uuid        not null default gen_random_uuid() primary key,
    user_id      uuid        not null,
    card_id      uuid        not null,
    variant_id   uuid        not null,
    variant_type text,
    old_quantity integer     not null default 0,
    new_quantity integer     not null,
    changed_at   timestamptz not null default now()
);

-- User sets (which sets a user is tracking + their collection goal)
-- NOTE: collection_goal: 'normal' | 'masterset' | 'grandmasterset'
create table if not exists public.user_sets (
    id              uuid        not null default gen_random_uuid() primary key,
    user_id         uuid        references public.users(id),   -- nullable
    set_id          text        references public.sets(set_id) on delete cascade,
    created_at      timestamp   default now(),
    collection_goal text        not null default 'normal'
                        check (collection_goal in ('normal','masterset','grandmasterset')),
    constraint user_sets_user_id_set_id_key unique (user_id, set_id)
);

-- User sealed products (tracks which sealed products a user owns)
-- NOTE: product_id is text — references set_products conceptually,
--       but no DB-level FK enforced (set_products.id is uuid).
create table if not exists public.user_sealed_products (
    id         uuid        not null default gen_random_uuid() primary key,
    user_id    uuid        not null,
    product_id text        not null,
    quantity   integer     not null default 1 check (quantity >= 0),
    created_at timestamp   default now(),
    updated_at timestamp   default now(),
    constraint user_sealed_products_user_id_product_id_key unique (user_id, product_id)
);

-- User graded cards (PSA/CGC/etc. graded cards owned by user)
create table if not exists public.user_graded_cards (
    id              uuid        not null default gen_random_uuid() primary key,
    user_id         uuid        not null references public.users(id) on delete cascade,
    card_id         uuid        not null references public.cards(id) on delete cascade,
    variant_id      uuid        references public.variants(id) on delete set null,
    grading_company text        not null
                        check (grading_company in ('PSA','BECKETT','CGC','TAG','ACE')),
    grade           text        not null,
    quantity        integer     not null default 1 check (quantity >= 1),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint user_graded_cards_unique unique (user_id, card_id, variant_id, grading_company, grade)
);

-- User card lists (custom named card lists, e.g. "Yuka Collection")
create table if not exists public.user_card_lists (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null references public.users(id) on delete cascade,
    name        text        not null,
    description text,
    is_public   boolean     not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- User card list items (cards inside a custom list)
create table if not exists public.user_card_list_items (
    id       uuid        primary key default gen_random_uuid(),
    list_id  uuid        not null references public.user_card_lists(id) on delete cascade,
    card_id  uuid        not null references public.cards(id) on delete cascade,
    added_at timestamptz not null default now(),
    constraint user_card_list_items_list_card_key unique (list_id, card_id)
);

-- Trade proposals
-- NOTE: status: 'pending' | 'accepted' | 'declined' | 'withdrawn'
--       currency_code: ISO 4217 (limited to the supported list below).
create table if not exists public.trade_proposals (
    id             uuid        not null default gen_random_uuid() primary key,
    proposer_id    uuid        not null references public.users(id) on delete cascade,
    receiver_id    uuid        not null references public.users(id) on delete cascade,
    status         text        not null default 'pending'
                       check (status in ('pending','accepted','declined','withdrawn')),
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    cash_offered   numeric     not null default 0 check (cash_offered >= 0),
    cash_requested numeric     not null default 0 check (cash_requested >= 0),
    currency_code  text        not null default 'EUR'
                       check (currency_code in ('EUR','USD','GBP','NOK','SEK','DKK','CAD','AUD','JPY','CHF')),
    constraint trade_proposals_no_self check (proposer_id <> receiver_id)
);

-- Trade proposal items (individual cards in a trade)
-- NOTE: direction: 'offering' (proposer sends) | 'requesting' (proposer wants)
create table if not exists public.trade_proposal_items (
    id          uuid        not null default gen_random_uuid() primary key,
    proposal_id uuid        not null references public.trade_proposals(id) on delete cascade,
    card_id     uuid        not null references public.cards(id) on delete cascade,
    direction   text        not null check (direction in ('offering','requesting')),
    quantity    integer     not null default 1 check (quantity >= 1)
);

-- Variant suggestions (submitted by users, reviewed by admins)
create table if not exists public.variant_suggestions (
    id          uuid        not null default gen_random_uuid() primary key,
    name        text,
    key         text,
    status      text        default 'pending',
    created_by  uuid        references public.users(id) on delete set null,
    created_at  timestamp   default now(),
    card_id     text,       -- text reference (not a UUID FK)
    description text
);

-- Stories (CMS news/articles table)
-- NOTE: content is a JSONB array of typed blocks (paragraphs, headings, lists, etc.)
--       is_published defaults to true — no draft mode needed.
create table if not exists public.stories (
    id              uuid        not null default gen_random_uuid() primary key,
    slug            text        not null unique,
    category        text        not null,
    category_icon   text        not null,
    title           text        not null,
    description     text        not null,
    gradient        text        not null,
    accent_colour   text        not null default 'text-indigo-300',
    cover_image_url text,
    content         jsonb       not null default '[]',
    is_published    boolean     not null default true,
    published_at    timestamptz not null default now(),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- User subscriptions (membership tier: free / pro)
-- NOTE: A missing row is treated as free tier by the application.
--       Stripe billing metadata stored for Pro subscribers.
create table if not exists public.user_subscriptions (
    id                     uuid        not null default gen_random_uuid() primary key,
    user_id                uuid        not null unique references public.users(id) on delete cascade,
    tier                   text        not null default 'free'
                               check (tier in ('free','pro')),
    billing_period         text        check (billing_period in ('monthly','annual')),
    current_period_start   timestamptz,
    current_period_end     timestamptz,
    stripe_customer_id     text,
    stripe_subscription_id text,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);


-- ── ROW LEVEL SECURITY ────────────────────────────────────────

alter table public.achievements              enable row level security;
alter table public.card_cm_url_overrides     enable row level security;
alter table public.card_graded_prices        enable row level security;
alter table public.card_price_history        enable row level security;
alter table public.card_prices               enable row level security;
alter table public.card_variant_availability enable row level security;
alter table public.card_variant_images       enable row level security;
alter table public.friendships               enable row level security;
alter table public.price_points              enable row level security;
alter table public.set_products              enable row level security;
alter table public.sets                      enable row level security;
alter table public.trade_proposal_items      enable row level security;
alter table public.trade_proposals           enable row level security;
alter table public.user_achievements         enable row level security;
alter table public.user_card_activity_log    enable row level security;
alter table public.user_card_list_items      enable row level security;
alter table public.user_card_lists           enable row level security;
alter table public.user_card_variants        enable row level security;
alter table public.user_cards                enable row level security;
alter table public.user_graded_cards         enable row level security;
alter table public.user_sealed_products      enable row level security;
alter table public.user_sets                 enable row level security;
alter table public.users                     enable row level security;
alter table public.variant_suggestions       enable row level security;
alter table public.variants                  enable row level security;
alter table public.wanted_cards              enable row level security;
alter table public.stories                   enable row level security;
alter table public.user_subscriptions        enable row level security;


-- ── FUNCTIONS ─────────────────────────────────────────────────

-- Returns true if the current user has role = 'admin'
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
begin
    return exists (
        select 1 from public.users
        where id = auth.uid()
        and role = 'admin'
    );
end;
$$;

-- Returns true if the given user_id has role = 'admin'
create or replace function public.is_admin_by_user_id(user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
    return exists (
        select 1 from public.users
        where id = user_id
        and role = 'admin'
    );
end;
$$;

-- Returns true if current user owns the resource or is admin
create or replace function public.is_admin_or_owner(user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
    return auth.uid() = user_id or public.is_admin();
end;
$$;

-- Returns image coverage statistics per set (used by admin image upload tool)
create or replace function public.get_set_image_stats()
returns table(
    set_id            text,
    total_cards       bigint,
    cards_with_images bigint
)
language sql
stable
as $$
    select
        set_id,
        count(*)     as total_cards,
        count(image) as cards_with_images  -- count() ignores NULLs
    from cards
    group by set_id;
$$;

-- Returns distinct owned card counts per set for a user (used for collection stats)
create or replace function public.get_user_card_counts_by_set(p_user_id uuid)
returns table(set_id text, card_count bigint)
language sql
stable
security definer
as $$
    select
        c.set_id,
        count(distinct ucv.card_id) as card_count
    from user_card_variants ucv
    join cards c on ucv.card_id = c.id
    where ucv.user_id = p_user_id
      and ucv.quantity > 0
    group by c.set_id;
$$;

grant execute on function public.get_user_card_counts_by_set(uuid) to anon, authenticated;

-- Atomic increment/decrement for user_card_variants.
-- Replaces the old read→compute→write pattern with a single DB round-trip.
-- Cleans up zero-quantity rows automatically.
create or replace function public.increment_user_card_variant(
    p_user_id    uuid,
    p_card_id    uuid,
    p_variant_id uuid,
    p_increment  integer
)
returns integer
language plpgsql
as $$
declare
    v_new_qty integer;
begin
    if p_increment > 0 then
        insert into user_card_variants
            (user_id, card_id, variant_id, quantity, quantity_delta, updated_at)
        values
            (p_user_id, p_card_id, p_variant_id, p_increment, p_increment, now())
        on conflict (user_id, card_id, variant_id)
        do update set
            quantity       = greatest(0, user_card_variants.quantity + p_increment),
            quantity_delta = p_increment,
            updated_at     = now()
        returning quantity into v_new_qty;
    else
        update user_card_variants
        set
            quantity       = greatest(0, quantity + p_increment),
            quantity_delta = p_increment,
            updated_at     = now()
        where user_id    = p_user_id
          and card_id    = p_card_id
          and variant_id = p_variant_id
        returning quantity into v_new_qty;

        v_new_qty := coalesce(v_new_qty, 0);
    end if;

    if coalesce(v_new_qty, 0) = 0 then
        delete from user_card_variants
        where user_id    = p_user_id
          and card_id    = p_card_id
          and variant_id = p_variant_id;
    end if;

    return coalesce(v_new_qty, 0);
end;
$$;

-- Trigger function: sets updated_at to current UTC timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

-- Trigger function: auto-creates public.users profile on email confirmation
-- NOTE: This function is invoked by a trigger on auth.users (not in public schema).
--       The trigger itself is managed outside this file.
create or replace function public.handle_new_confirmed_user()
returns trigger
language plpgsql
security definer
as $$
begin
    if old.email_confirmed_at is null and new.email_confirmed_at is not null then
        insert into public.users (id, username, avatar_url)
        values (
            new.id,
            coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
            new.raw_user_meta_data->>'avatar_url'
        )
        on conflict (id) do nothing;
    end if;
    return new;
end;
$$;


-- ── TRIGGERS ──────────────────────────────────────────────────

create or replace trigger handle_updated_at_card_prices
    before update on public.card_prices
    for each row execute function public.handle_updated_at();

create or replace trigger handle_updated_at_friendships
    before update on public.friendships
    for each row execute function public.handle_updated_at();

create or replace trigger handle_updated_at_set_products
    before update on public.set_products
    for each row execute function public.handle_updated_at();

create or replace trigger handle_updated_at_trade_proposals
    before update on public.trade_proposals
    for each row execute function public.handle_updated_at();

create or replace trigger handle_updated_at_user_sealed_products
    before update on public.user_sealed_products
    for each row execute function public.handle_updated_at();

create or replace trigger handle_updated_at_user_subscriptions
    before update on public.user_subscriptions
    for each row execute function public.handle_updated_at();

create or replace trigger handle_updated_at_stories
    before update on public.stories
    for each row execute function public.handle_updated_at();


-- ── RLS POLICIES ──────────────────────────────────────────────

-- achievements
create policy "Everyone can view achievements"
    on public.achievements for select using (true);

-- card_cm_url_overrides
create policy "ccuo_read_all"
    on public.card_cm_url_overrides for select using (true);

-- card_graded_prices
create policy "card_graded_prices_public_read"
    on public.card_graded_prices for select using (true);
create policy "card_graded_prices_admin_insert"
    on public.card_graded_prices for insert with check (public.is_admin());
create policy "card_graded_prices_admin_update"
    on public.card_graded_prices for update using (public.is_admin());
create policy "card_graded_prices_admin_delete"
    on public.card_graded_prices for delete using (public.is_admin());

-- card_price_history
create policy "card_price_history_public_read"
    on public.card_price_history for select using (true);
create policy "card_price_history_admin_insert"
    on public.card_price_history for insert with check (public.is_admin());
create policy "card_price_history_admin_delete"
    on public.card_price_history for delete using (public.is_admin());

-- card_prices
create policy "card_prices_public_read"
    on public.card_prices for select using (true);
create policy "card_prices_admin_insert"
    on public.card_prices for insert with check (public.is_admin());
create policy "card_prices_admin_update"
    on public.card_prices for update using (public.is_admin());
create policy "card_prices_admin_delete"
    on public.card_prices for delete using (public.is_admin());

-- card_variant_availability
create policy "cva_read_all"
    on public.card_variant_availability for select using (true);

-- card_variant_images
create policy "cvi_read_all"
    on public.card_variant_images for select using (true);

-- friendships
create policy "friendships_requester_insert"
    on public.friendships for insert with check (auth.uid() = requester_id);
create policy "friendships_parties_select"
    on public.friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_parties_update"
    on public.friendships for update using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_parties_delete"
    on public.friendships for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_admin_all"
    on public.friendships for all using (public.is_admin());

-- price_points
create policy "price_points_select_public"
    on public.price_points for select to anon, authenticated using (true);
create policy "price_points_insert_admin"
    on public.price_points for insert to authenticated with check (public.is_admin());
create policy "price_points_update_admin"
    on public.price_points for update to authenticated using (public.is_admin());
create policy "price_points_delete_admin"
    on public.price_points for delete to authenticated using (public.is_admin());

-- set_products
create policy "set_products_public_read"
    on public.set_products for select using (true);
create policy "set_products_admin_insert"
    on public.set_products for insert with check (public.is_admin());
create policy "set_products_admin_update"
    on public.set_products for update using (public.is_admin());
create policy "set_products_admin_delete"
    on public.set_products for delete using (public.is_admin());

-- sets
create policy "Everyone can view sets"
    on public.sets for select using (true);

-- trade_proposal_items
create policy "trade_proposal_items_select"
    on public.trade_proposal_items for select
    using (exists (
        select 1 from trade_proposals p
        where p.id = trade_proposal_items.proposal_id
          and (p.proposer_id = auth.uid() or p.receiver_id = auth.uid())
    ));
create policy "trade_proposal_items_insert"
    on public.trade_proposal_items for insert
    with check (exists (
        select 1 from trade_proposals p
        where p.id = trade_proposal_items.proposal_id
          and p.proposer_id = auth.uid()
    ));
create policy "trade_proposal_items_admin_all"
    on public.trade_proposal_items for all using (public.is_admin());

-- trade_proposals
create policy "trade_proposals_parties_select"
    on public.trade_proposals for select using (auth.uid() = proposer_id or auth.uid() = receiver_id);
create policy "trade_proposals_proposer_insert"
    on public.trade_proposals for insert with check (auth.uid() = proposer_id);
create policy "trade_proposals_parties_update"
    on public.trade_proposals for update using (auth.uid() = proposer_id or auth.uid() = receiver_id);
create policy "trade_proposals_admin_all"
    on public.trade_proposals for all using (public.is_admin());

-- user_achievements
create policy "User achievements are viewable by everyone"
    on public.user_achievements for select using (true);
create policy "Users can insert their own achievements"
    on public.user_achievements for insert with check (auth.uid() = user_id);

-- user_card_activity_log
create policy "Users can view their own card activity log."
    on public.user_card_activity_log for select using (auth.uid() = user_id);

-- user_card_list_items
create policy "user_card_list_items_select"
    on public.user_card_list_items for select
    using (exists (
        select 1 from user_card_lists l
        where l.id = user_card_list_items.list_id
          and (l.user_id = auth.uid() or l.is_public = true)
    ));
create policy "user_card_list_items_owner_insert"
    on public.user_card_list_items for insert
    with check (exists (
        select 1 from user_card_lists l
        where l.id = user_card_list_items.list_id
          and l.user_id = auth.uid()
    ));
create policy "user_card_list_items_owner_delete"
    on public.user_card_list_items for delete
    using (exists (
        select 1 from user_card_lists l
        where l.id = user_card_list_items.list_id
          and l.user_id = auth.uid()
    ));
create policy "user_card_list_items_admin_all"
    on public.user_card_list_items for all using (public.is_admin());

-- user_card_lists
create policy "user_card_lists_owner_select"
    on public.user_card_lists for select using (auth.uid() = user_id or is_public = true);
create policy "user_card_lists_owner_insert"
    on public.user_card_lists for insert with check (auth.uid() = user_id);
create policy "user_card_lists_owner_update"
    on public.user_card_lists for update using (auth.uid() = user_id);
create policy "user_card_lists_owner_delete"
    on public.user_card_lists for delete using (auth.uid() = user_id);
create policy "user_card_lists_admin_all"
    on public.user_card_lists for all using (public.is_admin());

-- user_card_variants
create policy "Authenticated users can view any user's card variants"
    on public.user_card_variants for select using (auth.role() = 'authenticated');
create policy "Users can manage their variants"
    on public.user_card_variants for all using (auth.uid() = user_id);

-- user_cards
create policy "Users can update their own cards."
    on public.user_cards for update using (auth.uid() = user_id);

-- user_graded_cards
create policy "user_graded_cards_select_own"
    on public.user_graded_cards for select using (auth.uid() = user_id);
create policy "user_graded_cards_insert_own"
    on public.user_graded_cards for insert with check (auth.uid() = user_id);
create policy "user_graded_cards_update_own"
    on public.user_graded_cards for update using (auth.uid() = user_id);
create policy "user_graded_cards_delete_own"
    on public.user_graded_cards for delete using (auth.uid() = user_id);
create policy "user_graded_cards_admin_all"
    on public.user_graded_cards for all using (public.is_admin());

-- user_sealed_products
create policy "Users can view their own sealed products."
    on public.user_sealed_products for select using (auth.uid() = user_id);
create policy "Users can insert their own sealed products."
    on public.user_sealed_products for insert with check (auth.uid() = user_id);
create policy "Users can update their own sealed products."
    on public.user_sealed_products for update using (auth.uid() = user_id);
create policy "Users can delete their own sealed products."
    on public.user_sealed_products for delete using (auth.uid() = user_id);

-- user_sets
create policy "Authenticated users can view any user's sets"
    on public.user_sets for select using (auth.role() = 'authenticated');

-- users
create policy "Users can view their own profile"
    on public.users for select using (auth.uid() = id);
create policy "Authenticated users can view any profile"
    on public.users for select using (auth.role() = 'authenticated');
create policy "Admins can view all users"
    on public.users for select using (public.is_admin());
create policy "Users can insert own profile"
    on public.users for insert with check (auth.uid() = id);
create policy "Users can update own profile"
    on public.users for update using (auth.uid() = id);

-- variant_suggestions
create policy "Everyone can view variant suggestions"
    on public.variant_suggestions for select using (true);
create policy "Authenticated users can create variant suggestions"
    on public.variant_suggestions for insert with check (auth.uid() = created_by);
create policy "Admins can update variant suggestions"
    on public.variant_suggestions for update using (public.is_admin());

-- variants
create policy "Everyone can view variants"
    on public.variants for select using (true);
create policy "Admins can manage variants"
    on public.variants for all using (public.is_admin());

-- wanted_cards
create policy "wanted_cards_owner_select"
    on public.wanted_cards for select using (auth.uid() = user_id);
create policy "wanted_cards_owner_insert"
    on public.wanted_cards for insert with check (auth.uid() = user_id);
create policy "wanted_cards_owner_delete"
    on public.wanted_cards for delete using (auth.uid() = user_id);
create policy "wanted_cards_admin_all"
    on public.wanted_cards for all using (public.is_admin());

-- stories
create policy "stories_public_select"
    on public.stories for select using (is_published = true);
create policy "stories_admin_all"
    on public.stories for all using (public.is_admin());

-- user_subscriptions
create policy "user_subscriptions_owner_select"
    on public.user_subscriptions for select using (auth.uid() = user_id);
create policy "user_subscriptions_admin_all"
    on public.user_subscriptions for all using (public.is_admin());


-- ── INDEXES ───────────────────────────────────────────────────

-- achievements
-- (achievements_name_key is created by the unique constraint above)

-- card_cm_url_overrides
create index if not exists idx_ccuo_card_id
    on public.card_cm_url_overrides(card_id);

-- card_graded_prices
create index if not exists card_graded_prices_card_id_idx
    on public.card_graded_prices(card_id);
create index if not exists card_graded_prices_company_idx
    on public.card_graded_prices(grading_company);
create index if not exists card_graded_prices_fetched_at_idx
    on public.card_graded_prices(fetched_at desc);

-- card_price_history
create index if not exists cph_card_id_recorded_idx
    on public.card_price_history(card_id, recorded_at desc);
create index if not exists cph_card_variant_idx
    on public.card_price_history(card_id, variant_key, recorded_at desc);
create index if not exists cph_source_idx
    on public.card_price_history(source);

-- card_prices
create index if not exists card_prices_card_id_idx
    on public.card_prices(card_id);
create index if not exists card_prices_fetched_at_idx
    on public.card_prices(fetched_at desc);

-- card_variant_availability
create index if not exists idx_cva_card_id    on public.card_variant_availability(card_id);
create index if not exists idx_cva_variant_id on public.card_variant_availability(variant_id);

-- card_variant_images
create index if not exists idx_cvi_card_id    on public.card_variant_images(card_id);
create index if not exists idx_cvi_variant_id on public.card_variant_images(variant_id);

-- cards
create index if not exists cards_api_id_idx
    on public.cards(api_id) where api_id is not null;
create index if not exists cards_default_variant_idx
    on public.cards(default_variant_id);
create index if not exists cards_source_card_id_idx
    on public.cards(source_card_id) where source_card_id is not null;
create index if not exists idx_cards_name   on public.cards(name);
create index if not exists idx_cards_set_id on public.cards(set_id);
create index if not exists cards_tcggo_id_idx
    on public.cards(tcggo_id) where tcggo_id is not null;

-- ebay_webhooks
create index if not exists ebay_webhooks_created_at_idx
    on public.ebay_webhooks(created_at desc);

-- friendships
create index if not exists friendships_requester_idx
    on public.friendships(requester_id, status);
create index if not exists friendships_addressee_idx
    on public.friendships(addressee_id, status);
create index if not exists friendships_accepted_requester_idx
    on public.friendships(requester_id) where status = 'accepted';
create index if not exists friendships_accepted_addressee_idx
    on public.friendships(addressee_id) where status = 'accepted';

-- price_points
create index if not exists idx_price_points_card_id
    on public.price_points(card_id);
create index if not exists idx_price_points_source
    on public.price_points(source);
create index if not exists idx_price_points_variant_key
    on public.price_points(variant_key);

-- set_products
create index if not exists set_products_set_id_idx
    on public.set_products(set_id);
create index if not exists set_products_product_type_idx
    on public.set_products(product_type);

-- sets
create index if not exists sets_release_date_idx
    on public.sets(release_date desc);
create index if not exists sets_series_idx
    on public.sets(series);
create index if not exists idx_sets_prices_last_synced_at
    on public.sets(prices_last_synced_at);

-- trade_proposal_items
create index if not exists trade_proposal_items_proposal_idx
    on public.trade_proposal_items(proposal_id);

-- trade_proposals
create index if not exists trade_proposals_proposer_idx
    on public.trade_proposals(proposer_id, status);
create index if not exists trade_proposals_receiver_idx
    on public.trade_proposals(receiver_id, status);

-- user_achievements
create index if not exists user_achievements_user_id_idx
    on public.user_achievements(user_id);

-- user_card_activity_log
create index if not exists idx_card_activity_log_user_changed
    on public.user_card_activity_log(user_id, changed_at desc);

-- user_card_list_items
create index if not exists user_card_list_items_list_id_idx
    on public.user_card_list_items(list_id);
create index if not exists user_card_list_items_card_id_idx
    on public.user_card_list_items(card_id);

-- user_card_lists
create index if not exists user_card_lists_user_id_idx
    on public.user_card_lists(user_id);

-- user_card_variants
create index if not exists user_card_variants_user_id_idx
    on public.user_card_variants(user_id);
create index if not exists user_card_variants_card_id_idx
    on public.user_card_variants(card_id);
create index if not exists user_card_variants_variant_id_idx
    on public.user_card_variants(variant_id);
create index if not exists ucv_user_id_updated_at_idx
    on public.user_card_variants(user_id, updated_at desc);

-- user_graded_cards
create index if not exists user_graded_cards_user_id_idx
    on public.user_graded_cards(user_id);
create index if not exists user_graded_cards_card_id_idx
    on public.user_graded_cards(card_id);
create index if not exists user_graded_cards_user_card_idx
    on public.user_graded_cards(user_id, card_id);

-- user_sealed_products
create index if not exists usp_user_id_idx
    on public.user_sealed_products(user_id);
create index if not exists usp_product_id_idx
    on public.user_sealed_products(product_id);
create index if not exists usp_user_id_updated_at_idx
    on public.user_sealed_products(user_id, updated_at desc);

-- user_sets
create index if not exists user_sets_collection_goal_idx
    on public.user_sets(collection_goal);

-- variants
create index if not exists variants_key_idx
    on public.variants(key);
create index if not exists variants_color_idx
    on public.variants(color);
create index if not exists variants_is_official_idx
    on public.variants(is_official);
create index if not exists variants_sort_order_idx
    on public.variants(sort_order);
create index if not exists idx_variants_card_id
    on public.variants(card_id);

-- stories
create index if not exists stories_published_at_idx
    on public.stories(published_at desc) where is_published = true;
create index if not exists stories_slug_idx
    on public.stories(slug);

-- user_subscriptions
create index if not exists user_subscriptions_user_id_idx
    on public.user_subscriptions(user_id);

-- wanted_cards
create index if not exists wanted_cards_user_id_idx
    on public.wanted_cards(user_id);
create index if not exists wanted_cards_card_id_idx
    on public.wanted_cards(card_id);


-- ── DEFAULT VARIANT SEED DATA ─────────────────────────────────
-- Safe to re-run (ON CONFLICT DO NOTHING via the unique key constraint).
insert into public.variants (name, key, color, is_quick_add, sort_order, is_official) values
    ('Normal',       'normal',     'green',  true, 1, true),
    ('Reverse Holo', 'reverse',    'blue',   true, 2, true),
    ('Holo Rare',    'holo',       'purple', true, 3, true),
    ('Pokeball',     'pokeball',   'red',    true, 4, true),
    ('Masterball',   'masterball', 'yellow', true, 5, true)
on conflict (key) do nothing;
