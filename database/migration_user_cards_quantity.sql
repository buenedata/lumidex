-- ============================================================
-- Migration: Add quantity column and unique constraint to user_cards
-- Purpose: Restore legacy user_cards.quantity field used by
--          updateCardQuantity() in lib/store.ts for tracking
--          total card ownership alongside user_card_variants.
-- Run once against your Supabase database.
-- ============================================================

-- 1. Add quantity column (default 0, non-nullable)
alter table public.user_cards
  add column if not exists quantity integer not null default 0;

-- 2. Add unique constraint so upsert(onConflict: 'user_id,card_id') works
alter table public.user_cards
  drop constraint if exists user_cards_user_id_card_id_key;

alter table public.user_cards
  add constraint user_cards_user_id_card_id_key unique (user_id, card_id);

-- 3. Allow users to update their own cards (needed for upsert UPDATE path)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_cards' and policyname = 'Users can update their own cards.'
  ) then
    execute $policy$
      create policy "Users can update their own cards."
        on public.user_cards for update
        using (auth.uid() = user_id)
    $policy$;
  end if;
end;
$$;
