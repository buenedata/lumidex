-- =============================================================================
-- Lumidex Database Schema
-- Generated from live Supabase project: ysvskytxewtlxpxeiskf
-- Last updated: 2026-08-18
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Check if current authenticated user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin'
    );
END;
$$;

-- Check if a given user_id belongs to an admin
CREATE OR REPLACE FUNCTION public.is_admin_by_user_id(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
    return exists (
        select 1
        from public.users
        where id = user_id
        and role = 'admin'
    );
end;
$$;

-- Check if current user is admin or the specified user
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN auth.uid() = user_id OR public.is_admin();
END;
$$;

-- Generic updated_at trigger function (sets to UTC now)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- Generic updated_at trigger function (sets to now())
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Stories-specific updated_at trigger function
CREATE OR REPLACE FUNCTION public.stories_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Atomically increment/decrement a user_card_variant quantity
CREATE OR REPLACE FUNCTION public.increment_user_card_variant(
  p_user_id uuid,
  p_card_id uuid,
  p_variant_id uuid,
  p_increment integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_qty integer;
BEGIN
  IF p_increment > 0 THEN
    INSERT INTO user_card_variants
      (user_id, card_id, variant_id, quantity, quantity_delta, updated_at)
    VALUES
      (p_user_id, p_card_id, p_variant_id, p_increment, p_increment, now())
    ON CONFLICT (user_id, card_id, variant_id)
    DO UPDATE SET
      quantity       = GREATEST(0, user_card_variants.quantity + p_increment),
      quantity_delta = p_increment,
      updated_at     = now()
    RETURNING quantity INTO v_new_qty;

  ELSE
    UPDATE user_card_variants
    SET
      quantity       = GREATEST(0, quantity + p_increment),
      quantity_delta = p_increment,
      updated_at     = now()
    WHERE user_id    = p_user_id
      AND card_id    = p_card_id
      AND variant_id = p_variant_id
    RETURNING quantity INTO v_new_qty;

    v_new_qty := COALESCE(v_new_qty, 0);
  END IF;

  IF COALESCE(v_new_qty, 0) = 0 THEN
    DELETE FROM user_card_variants
    WHERE user_id    = p_user_id
      AND card_id    = p_card_id
      AND variant_id = p_variant_id;
  END IF;

  RETURN COALESCE(v_new_qty, 0);
END;
$$;

-- Trigger: create public profile when a user confirms their email
CREATE OR REPLACE FUNCTION public.handle_new_confirmed_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.users (id, username, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: auto-friend every new user with the first admin account
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.users
  WHERE role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL OR v_admin_id = NEW.id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (v_admin_id, NEW.id, 'accepted')
  ON CONFLICT (requester_id, addressee_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- RPC: artist card counts with sample images (search + limit supported)
CREATE OR REPLACE FUNCTION public.get_artist_card_counts(
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE(name text, card_count bigint, sample_images text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.artist                                                         AS name,
    COUNT(*)                                                         AS card_count,
    ARRAY_REMOVE(
      (ARRAY_AGG(c.image ORDER BY (c.image IS NULL) ASC, c.created_at DESC))[1:3],
      NULL
    )                                                                AS sample_images
  FROM public.cards c
  WHERE
    c.artist IS NOT NULL
    AND c.artist <> ''
    AND LOWER(TRIM(c.artist)) <> 'n/a'
    AND (p_search IS NULL OR c.artist ILIKE '%' || p_search || '%')
  GROUP BY c.artist
  ORDER BY card_count DESC
  LIMIT p_limit;
$$;

-- RPC: image coverage stats per set
CREATE OR REPLACE FUNCTION public.get_set_image_stats()
RETURNS TABLE(set_id text, total_cards bigint, cards_with_images bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT
    set_id,
    COUNT(*)       AS total_cards,
    COUNT(image)   AS cards_with_images
  FROM cards
  GROUP BY set_id;
$$;

-- RPC: card counts grouped by set for a user
CREATE OR REPLACE FUNCTION public.get_user_card_counts_by_set(p_user_id uuid)
RETURNS TABLE(set_id text, card_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  select
    c.set_id,
    count(distinct ucv.card_id) as card_count
  from user_card_variants ucv
  join cards c on ucv.card_id = c.id
  where ucv.user_id = p_user_id
    and ucv.quantity > 0
  group by c.set_id;
$$;

-- RPC: total quantity and distinct card count for a user
CREATE OR REPLACE FUNCTION public.get_user_collection_stats(p_user_id uuid)
RETURNS TABLE(total_quantity bigint, distinct_cards bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(SUM(quantity), 0)::bigint  AS total_quantity,
    COUNT(DISTINCT card_id)::bigint     AS distinct_cards
  FROM user_card_variants
  WHERE user_id = p_user_id
    AND quantity > 0;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- users (public profile, references auth.users)
CREATE TABLE public.users (
  id                    uuid        NOT NULL,
  username              text,
  email                 text,
  avatar_url            text,
  created_at            timestamp   DEFAULT now(),
  role                  text        NOT NULL DEFAULT 'user',
  display_name          text,
  banner_url            text,
  bio                   text,
  location              text,
  setup_completed       boolean     NOT NULL DEFAULT false,
  preferred_language    text        NOT NULL DEFAULT 'en',
  preferred_currency    text        NOT NULL DEFAULT 'USD',
  grey_out_unowned      boolean     NOT NULL DEFAULT true,
  profile_private       boolean     NOT NULL DEFAULT false,
  lists_public_by_default boolean   NOT NULL DEFAULT false,
  social_cardmarket     text,
  social_instagram      text,
  social_facebook       text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_username_key UNIQUE (username),
  CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['user'::text, 'admin'::text])),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- sets (TCG / card sets)
CREATE TABLE public.sets (
  set_id          text      NOT NULL,
  name            text      NOT NULL,
  series          text,
  "setTotal"      integer,
  release_date    date,
  created_at      timestamp DEFAULT now(),
  "setComplete"   integer,
  logo_url        text,
  symbol_url      text,
  language        text      NOT NULL DEFAULT 'en',
  api_set_id      text,
  game            text      NOT NULL DEFAULT 'pokemon',
  CONSTRAINT sets_pkey PRIMARY KEY (set_id)
);

-- cards (individual cards within sets)
-- NOTE: default_variant_id FK added via ALTER TABLE after variants is created
CREATE TABLE public.cards (
  id                uuid      NOT NULL DEFAULT gen_random_uuid(),
  set_id            text      NOT NULL,
  name              text      NOT NULL,
  number            text,
  rarity            text,
  type              text,
  created_at        timestamp DEFAULT now(),
  artist            text,
  image             text,
  hp                text,
  supertype         text,
  subtypes          text[],
  default_variant_id uuid,
  api_id            text,
  source_card_id    uuid,
  tcggo_id          integer,
  CONSTRAINT cards_pkey PRIMARY KEY (id),
  CONSTRAINT cards_set_id_fkey FOREIGN KEY (set_id)
    REFERENCES public.sets(set_id) ON DELETE CASCADE,
  CONSTRAINT cards_source_card_id_fkey FOREIGN KEY (source_card_id)
    REFERENCES public.cards(id) ON DELETE SET NULL
);

-- variants (card variants: holo, reverse holo, etc.)
CREATE TABLE public.variants (
  id            uuid      NOT NULL DEFAULT gen_random_uuid(),
  variant_type  text,
  created_at    timestamp DEFAULT now(),
  name          text      NOT NULL,
  key           text      NOT NULL,
  description   text,
  color         text      NOT NULL DEFAULT 'gray',
  short_label   text,
  is_quick_add  boolean   NOT NULL DEFAULT false,
  sort_order    integer   NOT NULL DEFAULT 0,
  is_official   boolean   NOT NULL DEFAULT true,
  created_by    uuid,
  card_id       uuid,
  game          text,
  CONSTRAINT variants_pkey PRIMARY KEY (id),
  CONSTRAINT variants_key_unique UNIQUE (key),
  CONSTRAINT variants_color_check CHECK (
    color = ANY (ARRAY[
      'green'::text, 'blue'::text, 'purple'::text, 'red'::text, 'pink'::text,
      'yellow'::text, 'gray'::text, 'orange'::text, 'teal'::text
    ])
  ),
  CONSTRAINT variants_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE
);

-- Resolve circular dependency: cards ↔ variants
ALTER TABLE public.cards
  ADD CONSTRAINT cards_default_variant_id_fkey
    FOREIGN KEY (default_variant_id) REFERENCES public.variants(id) ON DELETE SET NULL;

-- achievements (badge definitions)
CREATE TABLE public.achievements (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NOT NULL,
  icon        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT achievements_pkey PRIMARY KEY (id),
  CONSTRAINT achievements_name_key UNIQUE (name)
);

-- stories (CMS articles / blog posts)
CREATE TABLE public.stories (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  slug            text        NOT NULL,
  category        text        NOT NULL,
  category_icon   text        NOT NULL,
  title           text        NOT NULL,
  description     text        NOT NULL,
  gradient        text        NOT NULL,
  accent_colour   text        NOT NULL DEFAULT 'text-indigo-300',
  cover_image_url text,
  content         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  is_published    boolean     NOT NULL DEFAULT true,
  published_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stories_pkey PRIMARY KEY (id),
  CONSTRAINT stories_slug_key UNIQUE (slug)
);

-- set_products (booster boxes, tins, etc. for a set)
CREATE TABLE public.set_products (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  set_id          text        NOT NULL,
  api_product_id  text,
  name            text        NOT NULL,
  product_type    text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  image_url       text,
  CONSTRAINT set_products_pkey PRIMARY KEY (id),
  CONSTRAINT set_products_api_product_id_key UNIQUE (api_product_id)
);

-- missing_card_suggestions (user-submitted requests for missing cards)
CREATE TABLE public.missing_card_suggestions (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  card_name   text        NOT NULL,
  set_name    text,
  card_number text,
  variant     text,
  submitted_by uuid,
  status      text        NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT missing_card_suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT missing_card_suggestions_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'resolved'::text, 'dismissed'::text])
  ),
  CONSTRAINT missing_card_suggestions_submitted_by_fkey FOREIGN KEY (submitted_by)
    REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT missing_card_suggestions_resolved_by_fkey FOREIGN KEY (resolved_by)
    REFERENCES public.users(id) ON DELETE SET NULL
);

-- variant_suggestions (user-submitted variant proposals)
CREATE TABLE public.variant_suggestions (
  id          uuid      NOT NULL DEFAULT gen_random_uuid(),
  name        text,
  key         text,
  status      text      DEFAULT 'pending',
  created_by  uuid,
  created_at  timestamp DEFAULT now(),
  card_id     text,
  description text,
  CONSTRAINT variant_suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT variant_suggestions_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE SET NULL
);

-- card_variant_availability (which variants are available for a card)
CREATE TABLE public.card_variant_availability (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  card_id     uuid        NOT NULL,
  variant_id  uuid        NOT NULL,
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT card_variant_availability_pkey PRIMARY KEY (id),
  CONSTRAINT unique_card_variant UNIQUE (card_id, variant_id),
  CONSTRAINT card_variant_availability_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE,
  CONSTRAINT card_variant_availability_variant_id_fkey FOREIGN KEY (variant_id)
    REFERENCES public.variants(id) ON DELETE CASCADE,
  CONSTRAINT card_variant_availability_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE NO ACTION
);

-- card_variant_images (custom images per card+variant)
CREATE TABLE public.card_variant_images (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  card_id     uuid        NOT NULL,
  variant_id  uuid        NOT NULL,
  image_url   text        NOT NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT card_variant_images_pkey PRIMARY KEY (id),
  CONSTRAINT unique_card_variant_image UNIQUE (card_id, variant_id),
  CONSTRAINT card_variant_images_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE,
  CONSTRAINT card_variant_images_variant_id_fkey FOREIGN KEY (variant_id)
    REFERENCES public.variants(id) ON DELETE CASCADE,
  CONSTRAINT card_variant_images_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users(id) ON DELETE NO ACTION
);

-- friendships (friend requests / relationships between users)
CREATE TABLE public.friendships (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  requester_id  uuid        NOT NULL,
  addressee_id  uuid        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_pair_key UNIQUE (requester_id, addressee_id),
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'blocked'::text])
  ),
  CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

-- trade_proposals (card trade offers between users)
CREATE TABLE public.trade_proposals (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  proposer_id     uuid        NOT NULL,
  receiver_id     uuid        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  cash_offered    numeric     NOT NULL DEFAULT 0,
  cash_requested  numeric     NOT NULL DEFAULT 0,
  currency_code   text        NOT NULL DEFAULT 'EUR',
  CONSTRAINT trade_proposals_pkey PRIMARY KEY (id),
  CONSTRAINT trade_proposals_no_self CHECK (proposer_id <> receiver_id),
  CONSTRAINT trade_proposals_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])
  ),
  CONSTRAINT trade_proposals_cash_offered_check CHECK (cash_offered >= 0::numeric),
  CONSTRAINT trade_proposals_cash_requested_check CHECK (cash_requested >= 0::numeric),
  CONSTRAINT trade_proposals_currency_code_check CHECK (
    currency_code = ANY (ARRAY[
      'EUR'::text, 'USD'::text, 'GBP'::text, 'NOK'::text, 'SEK'::text,
      'DKK'::text, 'CAD'::text, 'AUD'::text, 'JPY'::text, 'CHF'::text
    ])
  ),
  CONSTRAINT trade_proposals_proposer_id_fkey FOREIGN KEY (proposer_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT trade_proposals_receiver_id_fkey FOREIGN KEY (receiver_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

-- trade_proposal_items (individual cards within a trade proposal)
CREATE TABLE public.trade_proposal_items (
  id          uuid    NOT NULL DEFAULT gen_random_uuid(),
  proposal_id uuid    NOT NULL,
  card_id     uuid    NOT NULL,
  direction   text    NOT NULL,
  quantity    integer NOT NULL DEFAULT 1,
  CONSTRAINT trade_proposal_items_pkey PRIMARY KEY (id),
  CONSTRAINT trade_proposal_items_direction_check CHECK (
    direction = ANY (ARRAY['offering'::text, 'requesting'::text])
  ),
  CONSTRAINT trade_proposal_items_quantity_check CHECK (quantity >= 1),
  CONSTRAINT trade_proposal_items_proposal_id_fkey FOREIGN KEY (proposal_id)
    REFERENCES public.trade_proposals(id) ON DELETE CASCADE,
  CONSTRAINT trade_proposal_items_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE
);

-- user_achievements (unlocked achievements per user)
CREATE TABLE public.user_achievements (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  achievement_id  uuid        NOT NULL,
  unlocked_at     timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id),
  CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id)
    REFERENCES public.achievements(id) ON DELETE CASCADE
);

-- user_card_activity_log (history of quantity changes per user+card+variant)
CREATE TABLE public.user_card_activity_log (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL,
  card_id       uuid        NOT NULL,
  variant_id    uuid        NOT NULL,
  variant_type  text,
  old_quantity  integer     NOT NULL DEFAULT 0,
  new_quantity  integer     NOT NULL,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_card_activity_log_pkey PRIMARY KEY (id)
);

-- user_card_lists (custom card lists / wishlists)
CREATE TABLE public.user_card_lists (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  name        text        NOT NULL,
  description text,
  is_public   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_card_lists_pkey PRIMARY KEY (id),
  CONSTRAINT user_card_lists_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

-- user_card_list_items (cards within a user's custom list)
CREATE TABLE public.user_card_list_items (
  id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  list_id   uuid        NOT NULL,
  card_id   uuid        NOT NULL,
  added_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_card_list_items_pkey PRIMARY KEY (id),
  CONSTRAINT user_card_list_items_list_card_key UNIQUE (list_id, card_id),
  CONSTRAINT user_card_list_items_list_id_fkey FOREIGN KEY (list_id)
    REFERENCES public.user_card_lists(id) ON DELETE CASCADE,
  CONSTRAINT user_card_list_items_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE
);

-- user_card_variants (quantity of each variant a user owns)
CREATE TABLE public.user_card_variants (
  id              uuid      NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid,
  card_id         uuid,
  variant_type    text,
  created_at      timestamp DEFAULT now(),
  variant_id      uuid,
  quantity        integer   DEFAULT 0,
  updated_at      timestamp DEFAULT now(),
  quantity_delta  integer,
  CONSTRAINT user_card_variants_pkey PRIMARY KEY (id),
  CONSTRAINT user_card_variants_unique UNIQUE (user_id, card_id, variant_id),
  CONSTRAINT user_card_variants_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_card_variants_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE,
  CONSTRAINT user_card_variants_variant_id_fkey FOREIGN KEY (variant_id)
    REFERENCES public.variants(id) ON DELETE CASCADE
);

-- user_cards (denormalized: whether a user has any copy of a card)
CREATE TABLE public.user_cards (
  id          uuid      NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid,
  card_id     uuid,
  created_at  timestamp DEFAULT now(),
  quantity    integer   NOT NULL DEFAULT 0,
  CONSTRAINT user_cards_pkey PRIMARY KEY (id),
  CONSTRAINT user_cards_user_id_card_id_key UNIQUE (user_id, card_id),
  CONSTRAINT user_cards_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE
);

-- user_graded_cards (graded/slabbed cards owned by a user)
CREATE TABLE public.user_graded_cards (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  card_id         uuid        NOT NULL,
  variant_id      uuid,
  grading_company text        NOT NULL,
  grade           text        NOT NULL,
  quantity        integer     NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_graded_cards_pkey PRIMARY KEY (id),
  CONSTRAINT user_graded_cards_unique UNIQUE (user_id, card_id, variant_id, grading_company, grade),
  CONSTRAINT user_graded_cards_grading_company_check CHECK (
    grading_company = ANY (ARRAY['PSA'::text, 'BECKETT'::text, 'CGC'::text, 'TAG'::text, 'ACE'::text])
  ),
  CONSTRAINT user_graded_cards_quantity_check CHECK (quantity >= 1),
  CONSTRAINT user_graded_cards_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_graded_cards_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE,
  CONSTRAINT user_graded_cards_variant_id_fkey FOREIGN KEY (variant_id)
    REFERENCES public.variants(id) ON DELETE SET NULL
);

-- user_sealed_products (sealed booster boxes / tins owned by a user)
CREATE TABLE public.user_sealed_products (
  id          uuid      NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid      NOT NULL,
  product_id  text      NOT NULL,
  quantity    integer   NOT NULL DEFAULT 1,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now(),
  CONSTRAINT user_sealed_products_pkey PRIMARY KEY (id),
  CONSTRAINT user_sealed_products_user_id_product_id_key UNIQUE (user_id, product_id),
  CONSTRAINT user_sealed_products_quantity_check CHECK (quantity >= 0)
);

-- user_sets (sets a user is tracking in their collection)
CREATE TABLE public.user_sets (
  id              uuid      NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid,
  set_id          text,
  created_at      timestamp DEFAULT now(),
  collection_goal text      NOT NULL DEFAULT 'normal',
  CONSTRAINT user_sets_pkey PRIMARY KEY (id),
  CONSTRAINT user_sets_user_id_set_id_key UNIQUE (user_id, set_id),
  CONSTRAINT user_sets_collection_goal_check CHECK (
    collection_goal = ANY (ARRAY['normal'::text, 'masterset'::text, 'grandmasterset'::text])
  ),
  CONSTRAINT user_sets_set_id_fkey FOREIGN KEY (set_id)
    REFERENCES public.sets(set_id) ON DELETE CASCADE
);

-- user_subscriptions (Stripe subscription / tier for a user)
CREATE TABLE public.user_subscriptions (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL,
  tier                    text        NOT NULL DEFAULT 'free',
  billing_period          text,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id),
  CONSTRAINT user_subscriptions_tier_check CHECK (
    tier = ANY (ARRAY['free'::text, 'pro'::text])
  ),
  CONSTRAINT user_subscriptions_billing_period_check CHECK (
    billing_period = ANY (ARRAY['monthly'::text, 'annual'::text])
  ),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE
);

-- wanted_cards (cards a user wants to acquire)
CREATE TABLE public.wanted_cards (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  card_id     uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wanted_cards_pkey PRIMARY KEY (id),
  CONSTRAINT wanted_cards_user_card_key UNIQUE (user_id, card_id),
  CONSTRAINT wanted_cards_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT wanted_cards_card_id_fkey FOREIGN KEY (card_id)
    REFERENCES public.cards(id) ON DELETE CASCADE
);


-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- Flat list of all accepted friend pairs (bidirectional)
CREATE OR REPLACE VIEW public.accepted_friends AS
  SELECT friendships.requester_id AS user_id,
         friendships.addressee_id AS friend_id
    FROM friendships
   WHERE friendships.status = 'accepted'::text
  UNION ALL
  SELECT friendships.addressee_id AS user_id,
         friendships.requester_id AS friend_id
    FROM friendships
   WHERE friendships.status = 'accepted'::text;

-- Convenience view: user_id → tier (mirrors user_subscriptions)
CREATE OR REPLACE VIEW public.user_tiers AS
  SELECT user_id,
         tier
    FROM user_subscriptions;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER handle_updated_at_friendships
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_set_products
  BEFORE UPDATE ON public.set_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.stories_set_updated_at();

CREATE TRIGGER handle_updated_at_trade_proposals
  BEFORE UPDATE ON public.trade_proposals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_user_sealed_products
  BEFORE UPDATE ON public.user_sealed_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER handle_new_user_admin_friendship
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin_friendship();


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.achievements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_variant_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_variant_images       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_card_suggestions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_proposal_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_proposals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_card_activity_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_card_list_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_card_lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_card_variants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_graded_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sealed_products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_suggestions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wanted_cards              ENABLE ROW LEVEL SECURITY;

-- achievements
CREATE POLICY "Everyone can view achievements"
  ON public.achievements FOR SELECT USING (true);

-- card_variant_availability
CREATE POLICY "cva_read_all"
  ON public.card_variant_availability FOR SELECT USING (true);

-- card_variant_images
CREATE POLICY "cvi_read_all"
  ON public.card_variant_images FOR SELECT USING (true);

-- cards
CREATE POLICY "Anyone can view cards"
  ON public.cards FOR SELECT USING (true);
CREATE POLICY "Admins can manage cards"
  ON public.cards FOR ALL USING (is_admin());

-- friendships
CREATE POLICY "friendships_parties_select"
  ON public.friendships FOR SELECT
  USING ((auth.uid() = requester_id) OR (auth.uid() = addressee_id));
CREATE POLICY "friendships_requester_insert"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_parties_update"
  ON public.friendships FOR UPDATE
  USING ((auth.uid() = requester_id) OR (auth.uid() = addressee_id));
CREATE POLICY "friendships_parties_delete"
  ON public.friendships FOR DELETE
  USING ((auth.uid() = requester_id) OR (auth.uid() = addressee_id));
CREATE POLICY "friendships_admin_all"
  ON public.friendships FOR ALL USING (is_admin());

-- missing_card_suggestions
CREATE POLICY "public_insert_missing_card_suggestions"
  ON public.missing_card_suggestions FOR INSERT
  WITH CHECK (true);
CREATE POLICY "admin_select_missing_card_suggestions"
  ON public.missing_card_suggestions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));
CREATE POLICY "admin_update_missing_card_suggestions"
  ON public.missing_card_suggestions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));

-- set_products
CREATE POLICY "set_products_public_read"
  ON public.set_products FOR SELECT USING (true);
CREATE POLICY "set_products_admin_insert"
  ON public.set_products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "set_products_admin_update"
  ON public.set_products FOR UPDATE USING (is_admin());
CREATE POLICY "set_products_admin_delete"
  ON public.set_products FOR DELETE USING (is_admin());

-- sets
CREATE POLICY "Everyone can view sets"
  ON public.sets FOR SELECT USING (true);

-- stories
CREATE POLICY "stories_public_select"
  ON public.stories FOR SELECT USING (is_published = true);

-- trade_proposal_items
CREATE POLICY "trade_proposal_items_select"
  ON public.trade_proposal_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM trade_proposals p
    WHERE p.id = trade_proposal_items.proposal_id
      AND (p.proposer_id = auth.uid() OR p.receiver_id = auth.uid())
  ));
CREATE POLICY "trade_proposal_items_insert"
  ON public.trade_proposal_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM trade_proposals p
    WHERE p.id = trade_proposal_items.proposal_id
      AND p.proposer_id = auth.uid()
  ));
CREATE POLICY "trade_proposal_items_admin_all"
  ON public.trade_proposal_items FOR ALL USING (is_admin());

-- trade_proposals
CREATE POLICY "trade_proposals_parties_select"
  ON public.trade_proposals FOR SELECT
  USING ((auth.uid() = proposer_id) OR (auth.uid() = receiver_id));
CREATE POLICY "trade_proposals_proposer_insert"
  ON public.trade_proposals FOR INSERT
  WITH CHECK (auth.uid() = proposer_id);
CREATE POLICY "trade_proposals_parties_update"
  ON public.trade_proposals FOR UPDATE
  USING ((auth.uid() = proposer_id) OR (auth.uid() = receiver_id));
CREATE POLICY "trade_proposals_admin_all"
  ON public.trade_proposals FOR ALL USING (is_admin());

-- user_achievements
CREATE POLICY "User achievements are viewable by everyone"
  ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "User achievements are viewable by everyone."
  ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "Users can insert their own achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- user_card_activity_log
CREATE POLICY "Users can view their own card activity log."
  ON public.user_card_activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- user_card_list_items
CREATE POLICY "user_card_list_items_select"
  ON public.user_card_list_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_card_lists l
    WHERE l.id = user_card_list_items.list_id
      AND (l.user_id = auth.uid() OR l.is_public = true)
  ));
CREATE POLICY "user_card_list_items_owner_insert"
  ON public.user_card_list_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_card_lists l
    WHERE l.id = user_card_list_items.list_id
      AND l.user_id = auth.uid()
  ));
CREATE POLICY "user_card_list_items_owner_delete"
  ON public.user_card_list_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_card_lists l
    WHERE l.id = user_card_list_items.list_id
      AND l.user_id = auth.uid()
  ));
CREATE POLICY "user_card_list_items_admin_all"
  ON public.user_card_list_items FOR ALL USING (is_admin());

-- user_card_lists
CREATE POLICY "user_card_lists_owner_select"
  ON public.user_card_lists FOR SELECT
  USING ((auth.uid() = user_id) OR (is_public = true));
CREATE POLICY "user_card_lists_owner_insert"
  ON public.user_card_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_card_lists_owner_update"
  ON public.user_card_lists FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "user_card_lists_owner_delete"
  ON public.user_card_lists FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "user_card_lists_admin_all"
  ON public.user_card_lists FOR ALL USING (is_admin());

-- user_card_variants
CREATE POLICY "Authenticated users can view any user's card variants"
  ON public.user_card_variants FOR SELECT
  USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Users can manage their variants"
  ON public.user_card_variants FOR ALL
  USING (auth.uid() = user_id);

-- user_cards
CREATE POLICY "Users can view their own cards"
  ON public.user_cards FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cards"
  ON public.user_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cards."
  ON public.user_cards FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cards"
  ON public.user_cards FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all user_cards"
  ON public.user_cards FOR ALL USING (is_admin());

-- user_graded_cards
CREATE POLICY "user_graded_cards_select_own"
  ON public.user_graded_cards FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "user_graded_cards_insert_own"
  ON public.user_graded_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_graded_cards_update_own"
  ON public.user_graded_cards FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "user_graded_cards_delete_own"
  ON public.user_graded_cards FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "user_graded_cards_admin_all"
  ON public.user_graded_cards FOR ALL USING (is_admin());

-- user_sealed_products
CREATE POLICY "Users can view their own sealed products."
  ON public.user_sealed_products FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sealed products."
  ON public.user_sealed_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sealed products."
  ON public.user_sealed_products FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sealed products."
  ON public.user_sealed_products FOR DELETE
  USING (auth.uid() = user_id);

-- user_sets
CREATE POLICY "Authenticated users can view any user's sets"
  ON public.user_sets FOR SELECT
  USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Users can insert their own sets"
  ON public.user_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sets"
  ON public.user_sets FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sets"
  ON public.user_sets FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all user_sets"
  ON public.user_sets FOR ALL USING (is_admin());

-- user_subscriptions
CREATE POLICY "Users can read their own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- users
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "Authenticated users can view any profile"
  ON public.users FOR SELECT
  USING (auth.role() = 'authenticated'::text);
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (is_admin());
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- variant_suggestions
CREATE POLICY "Everyone can view variant suggestions"
  ON public.variant_suggestions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create variant suggestions"
  ON public.variant_suggestions FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can update variant suggestions"
  ON public.variant_suggestions FOR UPDATE
  USING (is_admin());

-- variants
CREATE POLICY "Everyone can view variants"
  ON public.variants FOR SELECT USING (true);
CREATE POLICY "Admins can manage variants"
  ON public.variants FOR ALL USING (is_admin());

-- wanted_cards
CREATE POLICY "wanted_cards_owner_select"
  ON public.wanted_cards FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "wanted_cards_owner_insert"
  ON public.wanted_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wanted_cards_owner_delete"
  ON public.wanted_cards FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "wanted_cards_admin_all"
  ON public.wanted_cards FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- achievements
CREATE UNIQUE INDEX achievements_name_key ON public.achievements USING btree (name);

-- card_variant_availability
CREATE INDEX idx_cva_card_id    ON public.card_variant_availability USING btree (card_id);
CREATE INDEX idx_cva_variant_id ON public.card_variant_availability USING btree (variant_id);

-- card_variant_images
CREATE INDEX idx_cvi_card_id    ON public.card_variant_images USING btree (card_id);
CREATE INDEX idx_cvi_variant_id ON public.card_variant_images USING btree (variant_id);

-- cards
CREATE INDEX idx_cards_name               ON public.cards USING btree (name);
CREATE INDEX idx_cards_set_id             ON public.cards USING btree (set_id);
CREATE INDEX cards_default_variant_idx    ON public.cards USING btree (default_variant_id);
CREATE UNIQUE INDEX cards_api_id_idx      ON public.cards USING btree (api_id) WHERE (api_id IS NOT NULL);
CREATE INDEX cards_source_card_id_idx     ON public.cards USING btree (source_card_id) WHERE (source_card_id IS NOT NULL);
CREATE INDEX cards_tcggo_id_idx           ON public.cards USING btree (tcggo_id) WHERE (tcggo_id IS NOT NULL);

-- friendships
CREATE INDEX friendships_requester_idx          ON public.friendships USING btree (requester_id, status);
CREATE INDEX friendships_addressee_idx          ON public.friendships USING btree (addressee_id, status);
CREATE INDEX friendships_accepted_requester_idx ON public.friendships USING btree (requester_id) WHERE (status = 'accepted'::text);
CREATE INDEX friendships_accepted_addressee_idx ON public.friendships USING btree (addressee_id) WHERE (status = 'accepted'::text);

-- missing_card_suggestions
CREATE INDEX missing_card_suggestions_status_created_idx
  ON public.missing_card_suggestions USING btree (status, created_at DESC);

-- set_products
CREATE INDEX set_products_set_id_idx      ON public.set_products USING btree (set_id);
CREATE INDEX set_products_product_type_idx ON public.set_products USING btree (product_type);

-- sets
CREATE INDEX idx_sets_game          ON public.sets USING btree (game);
CREATE INDEX sets_release_date_idx  ON public.sets USING btree (release_date DESC);
CREATE INDEX sets_series_idx        ON public.sets USING btree (series);

-- stories
CREATE INDEX stories_slug_idx       ON public.stories USING btree (slug);
CREATE INDEX stories_published_at_idx ON public.stories USING btree (published_at DESC) WHERE (is_published = true);

-- trade_proposal_items
CREATE INDEX trade_proposal_items_proposal_idx ON public.trade_proposal_items USING btree (proposal_id);

-- trade_proposals
CREATE INDEX trade_proposals_proposer_idx ON public.trade_proposals USING btree (proposer_id, status);
CREATE INDEX trade_proposals_receiver_idx ON public.trade_proposals USING btree (receiver_id, status);

-- user_achievements
CREATE INDEX user_achievements_user_id_idx ON public.user_achievements USING btree (user_id);

-- user_card_activity_log
CREATE INDEX idx_card_activity_log_user_changed
  ON public.user_card_activity_log USING btree (user_id, changed_at DESC);

-- user_card_list_items
CREATE INDEX user_card_list_items_list_id_idx ON public.user_card_list_items USING btree (list_id);
CREATE INDEX user_card_list_items_card_id_idx ON public.user_card_list_items USING btree (card_id);

-- user_card_lists
CREATE INDEX user_card_lists_user_id_idx ON public.user_card_lists USING btree (user_id);

-- user_card_variants
CREATE UNIQUE INDEX user_card_variants_unique    ON public.user_card_variants USING btree (user_id, card_id, variant_id);
CREATE INDEX user_card_variants_user_id_idx      ON public.user_card_variants USING btree (user_id);
CREATE INDEX user_card_variants_card_id_idx      ON public.user_card_variants USING btree (card_id);
CREATE INDEX user_card_variants_variant_id_idx   ON public.user_card_variants USING btree (variant_id);
CREATE INDEX ucv_user_id_updated_at_idx          ON public.user_card_variants USING btree (user_id, updated_at DESC);

-- user_cards
CREATE UNIQUE INDEX user_cards_user_id_card_id_key ON public.user_cards USING btree (user_id, card_id);

-- user_graded_cards
CREATE UNIQUE INDEX user_graded_cards_unique       ON public.user_graded_cards USING btree (user_id, card_id, variant_id, grading_company, grade);
CREATE INDEX user_graded_cards_user_id_idx         ON public.user_graded_cards USING btree (user_id);
CREATE INDEX user_graded_cards_card_id_idx         ON public.user_graded_cards USING btree (card_id);
CREATE INDEX user_graded_cards_user_card_idx       ON public.user_graded_cards USING btree (user_id, card_id);

-- user_sealed_products
CREATE UNIQUE INDEX user_sealed_products_user_id_product_id_key
  ON public.user_sealed_products USING btree (user_id, product_id);
CREATE INDEX usp_user_id_idx         ON public.user_sealed_products USING btree (user_id);
CREATE INDEX usp_product_id_idx      ON public.user_sealed_products USING btree (product_id);
CREATE INDEX usp_user_id_updated_at_idx ON public.user_sealed_products USING btree (user_id, updated_at DESC);

-- user_sets
CREATE UNIQUE INDEX user_sets_user_id_set_id_key ON public.user_sets USING btree (user_id, set_id);
CREATE INDEX user_sets_collection_goal_idx       ON public.user_sets USING btree (collection_goal);

-- user_subscriptions
CREATE UNIQUE INDEX user_subscriptions_user_id_key ON public.user_subscriptions USING btree (user_id);
CREATE INDEX user_subscriptions_user_id_idx        ON public.user_subscriptions USING btree (user_id);

-- variant_suggestions
-- (only pkey index — generated automatically)

-- variants
CREATE INDEX idx_variants_card_id   ON public.variants USING btree (card_id);
CREATE INDEX variants_key_idx       ON public.variants USING btree (key);
CREATE INDEX variants_color_idx     ON public.variants USING btree (color);
CREATE INDEX variants_is_official_idx ON public.variants USING btree (is_official);
CREATE INDEX variants_sort_order_idx  ON public.variants USING btree (sort_order);

-- wanted_cards
CREATE UNIQUE INDEX wanted_cards_user_card_key ON public.wanted_cards USING btree (user_id, card_id);
CREATE INDEX wanted_cards_user_id_idx          ON public.wanted_cards USING btree (user_id);
CREATE INDEX wanted_cards_card_id_idx          ON public.wanted_cards USING btree (card_id);
