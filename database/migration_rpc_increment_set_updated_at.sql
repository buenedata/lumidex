-- ============================================================
-- Migration: update increment_user_card_variant RPC
-- Sets updated_at = now() and quantity_delta = p_increment on
-- every atomic increment/decrement so that Last Activity always
-- surfaces the most recently touched card variant.
--
-- p_increment IS the signed delta (e.g. +1 or -1), so storing it
-- directly as quantity_delta gives the exact change amount.
-- Run once in the Supabase SQL editor.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_user_card_variant(
  p_user_id    uuid,
  p_card_id    uuid,
  p_variant_id uuid,
  p_increment  integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_qty integer;
BEGIN
  IF p_increment > 0 THEN
    -- Insert or add to existing quantity atomically.
    -- On conflict, bump quantity and refresh tracking columns.
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
    -- Decrement in place (row must already exist).
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

  -- Clean up zero-quantity rows
  IF COALESCE(v_new_qty, 0) = 0 THEN
    DELETE FROM user_card_variants
    WHERE user_id    = p_user_id
      AND card_id    = p_card_id
      AND variant_id = p_variant_id;
  END IF;

  RETURN COALESCE(v_new_qty, 0);
END;
$$;

-- Re-grant execute permission (REPLACE revokes it)
GRANT EXECUTE ON FUNCTION increment_user_card_variant(uuid, uuid, uuid, integer)
  TO authenticated;
