-- ============================================================
-- Lumidex – Current Database Schema
-- Last updated: 2026-03-25
-- Source of truth: Supabase information_schema.columns query
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

-- Users (extends Supabase auth.users)
create table if not exists public.users (
    id          uuid primary key,                                      -- references auth.users
    username    text,
    email       text,
    avatar_url  text,
    role        text not null default 'user'::text,
    created_at  timestamp without time zone default now()
);

-- Sets
-- NOTE: primary key is set_id (text), not a UUID.
--       setTotal  = cards excluding secret rares.
--       setComplete = cards including secret rares.
create table if not exists public.sets (
    set_id      text primary key,
    name        text not null,
    series      text,
    "setTotal"  integer,
    "setComplete" integer,
    release_date date,
    logo_url    text,
    created_at  timestamp without time zone default now()
);

-- Cards
-- NOTE: id is a UUID (gen_random_uuid()).
--       set_id is a text FK referencing sets.set_id.
--       subtypes is a text[] array (e.g. ["Stage 1", "Pokémon"]).
--       source_card_id: nullable FK to another card row (same table).
--         Used for reprint/Prize-Pack sets so they inherit the source
--         card's image without re-uploading.  Collection tracking
--         remains independent because user_card_variants references
--         the card's own id.
create table if not exists public.cards (
    id             uuid not null default gen_random_uuid() primary key,
    set_id         text not null,                                         -- FK → sets.set_id
    name           text not null,
    number         text,
    rarity         text,
    type           text,               -- element type, e.g. "Grass", "Fire"
    image          text,               -- card's own uploaded image URL
    source_card_id uuid references public.cards(id) on delete set null,  -- FK → canonical printing
    artist         text,
    hp             text,
    supertype      text,               -- e.g. "Pokémon", "Trainer", "Energy"
    subtypes       text[],             -- e.g. '{"Stage 1","Pokémon"}'
    created_at     timestamp without time zone default now()
);

-- Variants (global catalog of card variant types)
-- There is NO card_id column — variants are global, not card-specific.
create table if not exists public.variants (
    id           uuid not null default gen_random_uuid() primary key,
    name         text not null,
    key          text not null,
    variant_type text,                  -- legacy column
    description  text,
    color        text not null default 'gray'::text
                   check (color in ('green','blue','purple','red','pink','yellow','gray','orange','teal')),
    short_label  text,
    is_quick_add boolean not null default false,
    sort_order   integer not null default 0,
    is_official  boolean not null default true,
    created_by   uuid,                  -- FK → users.id
    created_at   timestamp without time zone default now()
);

-- User-owned card variants (primary collection tracking table)
-- NOTE: card_id is uuid (FK → cards.id).
--       variant_type is a legacy text column kept alongside variant_id.
create table if not exists public.user_card_variants (
    id           uuid not null default gen_random_uuid() primary key,
    user_id      uuid,                  -- FK → users.id
    card_id      uuid,                  -- FK → cards.id (uuid)
    variant_id   uuid,                  -- FK → variants.id
    variant_type text,                  -- legacy column
    quantity     integer default 0,
    created_at   timestamp without time zone default now(),
    updated_at   timestamp without time zone default now()
);

-- Variant suggestions submitted by users
-- NOTE: card_id is TEXT (stores set-scoped card identifiers, not UUIDs).
create table if not exists public.variant_suggestions (
    id          uuid not null default gen_random_uuid() primary key,
    name        text,
    key         text,
    card_id     text,                   -- text reference, not a UUID FK
    description text,
    status      text default 'pending'::text,
    created_by  uuid,                   -- FK → users.id
    created_at  timestamp without time zone default now()
);

-- User sets (which sets a user is tracking)
create table if not exists public.user_sets (
    id         uuid not null default gen_random_uuid() primary key,
    user_id    uuid,                    -- FK → users.id (nullable in DB)
    set_id     text,                    -- FK → sets.set_id
    created_at timestamp without time zone default now()
);

-- User cards (legacy — tracks which cards a user owns; quantity mirrors
--             the sum stored in user_card_variants for backwards compat.)
create table if not exists public.user_cards (
    id         uuid not null default gen_random_uuid() primary key,
    user_id    uuid,                    -- FK → users.id
    card_id    uuid,                    -- FK → cards.id (uuid)
    quantity   integer not null default 0,
    created_at timestamp without time zone default now(),
    constraint user_cards_user_id_card_id_key unique (user_id, card_id)
);

-- User sealed products (tracks which sealed products a user owns)
-- product_id references set_products.id (text)
create table if not exists public.user_sealed_products (
    id           uuid not null default gen_random_uuid() primary key,
    user_id      uuid not null,               -- FK → users.id
    product_id   text not null,               -- FK → set_products.id
    quantity     integer not null default 1
                   check (quantity >= 0),
    created_at   timestamp without time zone default now(),
    updated_at   timestamp without time zone default now(),
    constraint user_sealed_products_user_id_product_id_key
        unique (user_id, product_id)
);

-- Achievements
create table if not exists public.achievements (
    id          uuid not null default gen_random_uuid() primary key,
    name        text not null,
    description text not null,
    icon        text not null,
    created_at  timestamp with time zone not null default timezone('utc'::text, now())
);

-- User achievements
create table if not exists public.user_achievements (
    id             uuid not null default gen_random_uuid() primary key,
    user_id        uuid not null,       -- FK → users.id
    achievement_id uuid not null,       -- FK → achievements.id
    unlocked_at    timestamp with time zone not null default timezone('utc'::text, now())
);

-- eBay webhook event log
-- Stores raw payloads received from eBay Marketplace Account Deletion /
-- notification subscriptions. Written server-side via service role only;
-- no user-facing RLS policies are required for this table.
create table if not exists public.ebay_webhooks (
    id         uuid not null default gen_random_uuid() primary key,
    payload    jsonb,
    created_at timestamp without time zone default now()
);

-- ── Row Level Security ────────────────────────────────────────
alter table public.users enable row level security;
alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.variants enable row level security;
alter table public.user_card_variants enable row level security;
alter table public.variant_suggestions enable row level security;
alter table public.user_sets enable row level security;
alter table public.user_cards enable row level security;
alter table public.user_sealed_products enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- ── Helper functions ─────────────────────────────────────────
create or replace function public.is_admin()
returns boolean as $$
begin
    return exists (
        select 1 from public.users
        where id = auth.uid() and role = 'admin'
    );
end;
$$ language plpgsql security definer;

create or replace function public.is_admin_or_owner(check_user_id uuid)
returns boolean as $$
begin
    return auth.uid() = check_user_id or public.is_admin();
end;
$$ language plpgsql security definer;

-- ── Policies: public read ────────────────────────────────────
create policy "Everyone can view sets."
    on public.sets for select using (true);

create policy "Everyone can view cards."
    on public.cards for select using (true);

create policy "Everyone can view variants."
    on public.variants for select using (true);

create policy "Everyone can view achievements."
    on public.achievements for select using (true);

create policy "Everyone can view variant suggestions."
    on public.variant_suggestions for select using (true);

-- ── Policies: users ──────────────────────────────────────────
create policy "Public profiles are viewable by everyone."
    on public.users for select using (true);

create policy "Users can insert profiles."
    on public.users for insert with check (auth.uid() = id or public.is_admin());

create policy "Users can update profiles."
    on public.users for update using (public.is_admin_or_owner(id));

create policy "Admins can delete users."
    on public.users for delete using (public.is_admin() and auth.uid() != id);

-- ── Policies: user_sets ──────────────────────────────────────
create policy "Users can view their own sets."
    on public.user_sets for select using (auth.uid() = user_id);

create policy "Users can insert their own sets."
    on public.user_sets for insert with check (auth.uid() = user_id);

create policy "Users can delete their own sets."
    on public.user_sets for delete using (auth.uid() = user_id);

-- ── Policies: user_sealed_products ───────────────────────────
create policy "Users can view their own sealed products."
    on public.user_sealed_products for select using (auth.uid() = user_id);

create policy "Users can insert their own sealed products."
    on public.user_sealed_products for insert with check (auth.uid() = user_id);

create policy "Users can update their own sealed products."
    on public.user_sealed_products for update using (auth.uid() = user_id);

create policy "Users can delete their own sealed products."
    on public.user_sealed_products for delete using (auth.uid() = user_id);

-- ── Policies: user_cards (legacy) ────────────────────────────
create policy "Users can view their own cards."
    on public.user_cards for select using (auth.uid() = user_id);

create policy "Users can insert their own cards."
    on public.user_cards for insert with check (auth.uid() = user_id);

create policy "Users can update their own cards."
    on public.user_cards for update using (auth.uid() = user_id);

create policy "Users can delete their own cards."
    on public.user_cards for delete using (auth.uid() = user_id);

-- ── Policies: user_card_variants ─────────────────────────────
create policy "Users can view their own card variants."
    on public.user_card_variants for select using (auth.uid() = user_id);

create policy "Users can insert their own card variants."
    on public.user_card_variants for insert with check (auth.uid() = user_id);

create policy "Users can update their own card variants."
    on public.user_card_variants for update using (auth.uid() = user_id);

create policy "Users can delete their own card variants."
    on public.user_card_variants for delete using (auth.uid() = user_id);

-- ── Policies: variant_suggestions ────────────────────────────
create policy "Authenticated users can suggest variants."
    on public.variant_suggestions for insert
    with check (auth.uid() = created_by);

-- ── Policies: user_achievements ──────────────────────────────
create policy "User achievements are viewable by everyone."
    on public.user_achievements for select using (true);

create policy "Users can insert their own achievements."
    on public.user_achievements for insert with check (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists cards_set_id_idx          on public.cards(set_id);
create index if not exists cards_name_idx            on public.cards(name);
create index if not exists cards_name_set_idx        on public.cards(name, set_id);

create index if not exists ucv_user_id_idx           on public.user_card_variants(user_id);
create index if not exists ucv_card_id_idx           on public.user_card_variants(card_id);
create index if not exists ucv_variant_id_idx        on public.user_card_variants(variant_id);

create index if not exists user_sets_user_id_idx     on public.user_sets(user_id);
create index if not exists user_sets_set_id_idx      on public.user_sets(set_id);

create index if not exists user_cards_user_id_idx    on public.user_cards(user_id);
create index if not exists user_cards_card_id_idx    on public.user_cards(card_id);

create index if not exists variants_is_official_idx  on public.variants(is_official);
create index if not exists variants_is_quick_add_idx on public.variants(is_quick_add);

create index if not exists vs_status_idx             on public.variant_suggestions(status);
create index if not exists vs_card_id_idx            on public.variant_suggestions(card_id);

create index if not exists usp_user_id_idx    on public.user_sealed_products(user_id);
create index if not exists usp_product_id_idx on public.user_sealed_products(product_id);

create index if not exists ua_user_id_idx            on public.user_achievements(user_id);

-- ── Triggers: updated_at ─────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger handle_updated_at_user_card_variants
    before update on public.user_card_variants
    for each row execute function public.handle_updated_at();

create trigger handle_updated_at_user_sealed_products
    before update on public.user_sealed_products
    for each row execute function public.handle_updated_at();

-- ── Default variant seed data ─────────────────────────────────
-- Safe to re-run (ON CONFLICT DO NOTHING requires a unique index on key).
insert into public.variants (name, key, color, is_quick_add, sort_order, is_official) values
    ('Normal',       'normal',     'green',  true, 1, true),
    ('Reverse Holo', 'reverse',    'blue',   true, 2, true),
    ('Holo Rare',    'holo',       'purple', true, 3, true),
    ('Pokeball',     'pokeball',   'red',    true, 4, true),
    ('Masterball',   'masterball', 'yellow', true, 5, true)
on conflict (key) do nothing;
