-- ============================================================
-- migration_missing_card_suggestions.sql
--
-- Creates the missing_card_suggestions table used for
-- user-reported cards that are absent from the database.
--
-- ⚠️  Run this manually in the Supabase SQL editor.
--     Do NOT execute automatically.
-- ============================================================

create table if not exists public.missing_card_suggestions (
  id           uuid        primary key default gen_random_uuid(),
  card_name    text        not null,
  set_name     text,
  card_number  text,
  variant      text,
  -- Optional: the user who submitted the report (null = anonymous)
  submitted_by uuid        references public.users (id) on delete set null,
  -- Workflow status: pending → resolved | dismissed
  status       text        not null default 'pending'
                           check (status in ('pending', 'resolved', 'dismissed')),
  resolved_at  timestamptz,
  resolved_by  uuid        references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Index for the admin listing query (status filter + date order)
create index if not exists missing_card_suggestions_status_created_idx
  on public.missing_card_suggestions (status, created_at desc);

-- ── Row-Level Security ────────────────────────────────────────────────────────

alter table public.missing_card_suggestions enable row level security;

-- Anyone (authenticated or anonymous) may insert a report.
create policy "public_insert_missing_card_suggestions"
  on public.missing_card_suggestions
  for insert
  with check (true);

-- Only admins may read pending reports.
create policy "admin_select_missing_card_suggestions"
  on public.missing_card_suggestions
  for select
  using (
    exists (
      select 1
      from   public.users
      where  users.id   = auth.uid()
        and  users.role = 'admin'
    )
  );

-- Only admins may update (approve / dismiss) reports.
create policy "admin_update_missing_card_suggestions"
  on public.missing_card_suggestions
  for update
  using (
    exists (
      select 1
      from   public.users
      where  users.id   = auth.uid()
        and  users.role = 'admin'
    )
  );
