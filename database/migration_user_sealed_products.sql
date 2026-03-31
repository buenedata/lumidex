-- ============================================================
-- Migration: user_sealed_products
-- Tracks sealed products (booster boxes, ETBs, packs, etc.)
-- owned by each user.
-- ============================================================

create table if not exists public.user_sealed_products (
    id           uuid not null default gen_random_uuid() primary key,
    user_id      uuid not null,               -- FK → users.id
    product_id   text not null,               -- FK → set_products.id (text)
    quantity     integer not null default 1
                   check (quantity >= 0),
    created_at   timestamp without time zone default now(),
    updated_at   timestamp without time zone default now(),
    constraint user_sealed_products_user_id_product_id_key
        unique (user_id, product_id)
);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.user_sealed_products enable row level security;

create policy "Users can view their own sealed products."
    on public.user_sealed_products for select
    using (auth.uid() = user_id);

create policy "Users can insert their own sealed products."
    on public.user_sealed_products for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own sealed products."
    on public.user_sealed_products for update
    using (auth.uid() = user_id);

create policy "Users can delete their own sealed products."
    on public.user_sealed_products for delete
    using (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists usp_user_id_idx    on public.user_sealed_products(user_id);
create index if not exists usp_product_id_idx on public.user_sealed_products(product_id);

-- ── updated_at trigger ────────────────────────────────────────
create trigger handle_updated_at_user_sealed_products
    before update on public.user_sealed_products
    for each row execute function public.handle_updated_at();
