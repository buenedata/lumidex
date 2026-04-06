-- Atomic increment/decrement for user_card_variants.
-- Replaces the old read→compute→write pattern in the API with a single DB round-trip.
--
-- Usage (from supabase-js):
--   const { data, error } = await supabase.rpc('increment_user_card_variant', {
--     p_user_id:   userId,
--     p_card_id:   cardId,
--     p_variant_id: variantId,
--     p_increment: 1   -- or -1 to decrement
--   })
--   const newQty = data   -- integer

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
    -- Insert or add to existing quantity atomically
    INSERT INTO user_card_variants (user_id, card_id, variant_id, quantity)
    VALUES (p_user_id, p_card_id, p_variant_id, p_increment)
    ON CONFLICT (user_id, card_id, variant_id)
    DO UPDATE SET quantity = GREATEST(0, user_card_variants.quantity + p_increment)
    RETURNING quantity INTO v_new_qty;

  ELSE
    -- Update in place; if row doesn't exist newQty stays NULL → treated as 0
    UPDATE user_card_variants
    SET    quantity = GREATEST(0, quantity + p_increment)
    WHERE  user_id    = p_user_id
      AND  card_id    = p_card_id
      AND  variant_id = p_variant_id
    RETURNING quantity INTO v_new_qty;

    v_new_qty := COALESCE(v_new_qty, 0);
  END IF;

  -- Clean up zero-quantity rows
  IF COALESCE(v_new_qty, 0) = 0 THEN
    DELETE FROM user_card_variants
    WHERE  user_id    = p_user_id
      AND  card_id    = p_card_id
      AND  variant_id = p_variant_id;
  END IF;

  RETURN COALESCE(v_new_qty, 0);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_user_card_variant(uuid, uuid, uuid, integer)
  TO authenticated;
