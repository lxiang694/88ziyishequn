-- ═══════════════════════════════════════════════════════════
-- 團購：新增「7-11 常溫取貨付款」
--
-- 請在 group_buy_schema.sql 之後執行。冪等，可重複執行。
-- 不修改任何既有訂單；既有檔期的常溫取貨預設關閉、運費 0。
--
-- 取貨方式代碼：
--   711         7-11 冷凍取貨付款（原本的，代碼不變，舊訂單不受影響）
--   711_normal  7-11 常溫取貨付款（新增）
--   home        黑貓冷凍宅配（貨到付款）
-- ═══════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.group_buy_campaigns ADD COLUMN IF NOT EXISTS ship_711_normal_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.group_buy_campaigns ADD COLUMN IF NOT EXISTS fee_711_normal integer NOT NULL DEFAULT 0;

-- 原本的 CHECK 沒有命名，依內容找出來換掉
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.group_buy_campaigns'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%ship_711_enabled%ship_home_enabled%'
      AND conname <> 'group_buy_campaigns_ship_any_chk'
  LOOP
    EXECUTE format('ALTER TABLE public.group_buy_campaigns DROP CONSTRAINT %I', r.conname);
  END LOOP;
  FOR r IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.group_buy_orders'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) LIKE '%shipping_method = ANY%' OR pg_get_constraintdef(oid) LIKE '%store_id IS NOT NULL%')
      AND conname NOT IN ('group_buy_orders_method_chk', 'group_buy_orders_store_chk')
  LOOP
    EXECUTE format('ALTER TABLE public.group_buy_orders DROP CONSTRAINT %I', r.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_buy_campaigns_ship_any_chk') THEN
    ALTER TABLE public.group_buy_campaigns ADD CONSTRAINT group_buy_campaigns_ship_any_chk
      CHECK (ship_711_enabled OR ship_711_normal_enabled OR ship_home_enabled);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_buy_campaigns_fee_711_normal_chk') THEN
    ALTER TABLE public.group_buy_campaigns ADD CONSTRAINT group_buy_campaigns_fee_711_normal_chk
      CHECK (fee_711_normal BETWEEN 0 AND 5000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_buy_orders_method_chk') THEN
    ALTER TABLE public.group_buy_orders ADD CONSTRAINT group_buy_orders_method_chk
      CHECK (shipping_method IN ('711', '711_normal', 'home'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_buy_orders_store_chk') THEN
    ALTER TABLE public.group_buy_orders ADD CONSTRAINT group_buy_orders_store_chk
      CHECK (shipping_method NOT IN ('711', '711_normal') OR (store_id IS NOT NULL AND store_name IS NOT NULL));
  END IF;
END $$;

-- 下單函式：多認得 711_normal（運費用 fee_711_normal、要選門市）
CREATE OR REPLACE FUNCTION public.place_group_buy_order(
  p_order_no text,
  p_campaign_slug text,
  p_customer_name text,
  p_phone text,
  p_shipping_method text,
  p_store_id bigint,
  p_home_address text,
  p_delivery_time text,
  p_note text,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  c group_buy_campaigns%ROWTYPE;
  it group_buy_items%ROWTYPE;
  entry jsonb;
  v_item_id bigint;
  v_qty integer;
  v_sold bigint;
  v_mine bigint;
  v_subtotal integer := 0;
  v_fee integer;
  v_order_id bigint;
  v_store record;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO c FROM group_buy_campaigns WHERE slug = p_campaign_slug FOR SHARE;
  IF NOT FOUND OR NOT c.is_published THEN RAISE EXCEPTION '團購不存在'; END IF;
  IF now() < c.starts_at THEN RAISE EXCEPTION '團購還沒開始'; END IF;
  IF now() >= c.ends_at THEN RAISE EXCEPTION '團購已截單'; END IF;

  IF p_shipping_method IN ('711', '711_normal') THEN
    IF p_shipping_method = '711' AND NOT c.ship_711_enabled THEN RAISE EXCEPTION '這一檔沒有開放 7-11 冷凍取貨'; END IF;
    IF p_shipping_method = '711_normal' AND NOT c.ship_711_normal_enabled THEN RAISE EXCEPTION '這一檔沒有開放 7-11 常溫取貨'; END IF;
    SELECT id, store_code, store_name, address INTO v_store
      FROM stores_711 WHERE id = p_store_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION '請重新選擇 7-11 門市'; END IF;
  ELSIF p_shipping_method = 'home' THEN
    IF NOT c.ship_home_enabled THEN RAISE EXCEPTION '這一檔沒有開放宅配'; END IF;
    IF p_home_address IS NULL OR char_length(trim(p_home_address)) < 8 THEN RAISE EXCEPTION '請填寫完整的收件地址'; END IF;
  ELSE
    RAISE EXCEPTION '請選擇取貨方式';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION '請至少選一樣商品';
  END IF;
  IF (SELECT count(DISTINCT value->>'item_id') FROM jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION '商品重複';
  END IF;

  -- 依商品 id 順序鎖定，兩張單同時搶最後幾件時不會互相卡死
  FOR entry IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY (value->>'item_id')::bigint LOOP
    v_item_id := (entry->>'item_id')::bigint;
    v_qty := (entry->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 999 THEN RAISE EXCEPTION '數量不正確'; END IF;

    SELECT * INTO it FROM group_buy_items WHERE id = v_item_id AND campaign_id = c.id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '商品已下架，請重新整理'; END IF;

    IF it.total_quota IS NOT NULL THEN
      SELECT COALESCE(sum(oi.quantity), 0) INTO v_sold
        FROM group_buy_order_items oi JOIN group_buy_orders o ON o.id = oi.order_id
        WHERE oi.item_id = it.id AND o.status <> '已取消';
      IF v_sold + v_qty > it.total_quota THEN
        RAISE EXCEPTION '「%」剩 % 件', it.name, greatest(it.total_quota - v_sold, 0);
      END IF;
    END IF;

    IF it.per_person_limit IS NOT NULL THEN
      SELECT COALESCE(sum(oi.quantity), 0) INTO v_mine
        FROM group_buy_order_items oi JOIN group_buy_orders o ON o.id = oi.order_id
        WHERE oi.item_id = it.id AND o.phone = p_phone AND o.status <> '已取消';
      IF v_mine + v_qty > it.per_person_limit THEN
        RAISE EXCEPTION '「%」每人限購 % 件（您已訂 % 件）', it.name, it.per_person_limit, v_mine;
      END IF;
    END IF;

    v_subtotal := v_subtotal + it.price * v_qty;
    v_lines := v_lines || jsonb_build_object('item_id', it.id, 'name', it.name, 'spec', it.spec, 'price', it.price, 'qty', v_qty);
  END LOOP;

  v_fee := CASE p_shipping_method WHEN '711' THEN c.fee_711 WHEN '711_normal' THEN c.fee_711_normal ELSE c.fee_home END;
  IF c.free_shipping_threshold IS NOT NULL AND v_subtotal >= c.free_shipping_threshold THEN v_fee := 0; END IF;

  INSERT INTO group_buy_orders(order_no, campaign_id, customer_name, phone, shipping_method,
      store_id, store_code, store_name, store_address, home_address, delivery_time, note,
      subtotal, shipping_fee, total_amount)
  VALUES (p_order_no, c.id, trim(p_customer_name), p_phone, p_shipping_method,
      CASE WHEN p_shipping_method IN ('711', '711_normal') THEN v_store.id END,
      CASE WHEN p_shipping_method IN ('711', '711_normal') THEN v_store.store_code END,
      CASE WHEN p_shipping_method IN ('711', '711_normal') THEN v_store.store_name END,
      CASE WHEN p_shipping_method IN ('711', '711_normal') THEN v_store.address END,
      CASE WHEN p_shipping_method = 'home' THEN trim(p_home_address) END,
      CASE WHEN p_shipping_method = 'home' THEN COALESCE(p_delivery_time, '不指定') END,
      COALESCE(trim(p_note), ''),
      v_subtotal, v_fee, v_subtotal + v_fee)
  RETURNING id INTO v_order_id;

  INSERT INTO group_buy_order_items(order_id, item_id, name_snapshot, spec_snapshot, unit_price, quantity, subtotal)
  SELECT v_order_id, (l->>'item_id')::bigint, l->>'name', l->>'spec', (l->>'price')::integer, (l->>'qty')::integer,
         (l->>'price')::integer * (l->>'qty')::integer
  FROM jsonb_array_elements(v_lines) l;

  RETURN jsonb_build_object('order_no', p_order_no, 'subtotal', v_subtotal, 'shipping_fee', v_fee, 'total_amount', v_subtotal + v_fee);
END;
$$;

REVOKE ALL ON FUNCTION public.place_group_buy_order(text, text, text, text, text, bigint, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_group_buy_order(text, text, text, text, text, bigint, text, text, text, jsonb) TO service_role;

COMMIT;

SELECT '已新增 7-11 常溫取貨' AS 結果;
