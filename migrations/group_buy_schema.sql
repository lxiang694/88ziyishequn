-- ═══════════════════════════════════════════════════════════
-- 團購（每月一檔）
--
-- 冪等，可重複執行。只新增團購自己的資料表、檢視與函式，
-- 不修改一般商品、一般訂單或任何既有資料。
--
-- 團購與一般商品分開：
--   • 商品是品牌方的（不是自家庫存），價格、限量只在該檔期有效
--   • 冷凍品，出貨時間跟著截單走，不能跟一般商品同一張單
--
-- 資料表
--   group_buy_campaigns    檔期：開團／截單時間、運送方式與運費
--   group_buy_items        該檔期的商品：團購價、每人限購、總量
--   group_buy_orders       團購訂單（7-11 取貨付款 或 黑貓冷凍宅配）
--   group_buy_order_items  訂單明細（下單當下的名稱與價格快照）
-- ═══════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.group_buy_campaigns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  subtitle text NOT NULL DEFAULT '' CHECK (char_length(subtitle) <= 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  cover_image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  ship_note text NOT NULL DEFAULT '' CHECK (char_length(ship_note) <= 200),
  ship_711_enabled boolean NOT NULL DEFAULT true,
  ship_home_enabled boolean NOT NULL DEFAULT false,
  fee_711 integer NOT NULL DEFAULT 0 CHECK (fee_711 BETWEEN 0 AND 5000),
  fee_home integer NOT NULL DEFAULT 0 CHECK (fee_home BETWEEN 0 AND 5000),
  free_shipping_threshold integer CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold BETWEEN 0 AND 1000000),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (ship_711_enabled OR ship_home_enabled)
);

CREATE TABLE IF NOT EXISTS public.group_buy_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id bigint NOT NULL REFERENCES public.group_buy_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  spec text NOT NULL DEFAULT '' CHECK (char_length(spec) <= 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 3000),
  image_url text,
  price integer NOT NULL CHECK (price BETWEEN 1 AND 100000),
  original_price integer CHECK (original_price IS NULL OR original_price BETWEEN 1 AND 1000000),
  per_person_limit integer CHECK (per_person_limit IS NULL OR per_person_limit BETWEEN 1 AND 999),
  total_quota integer CHECK (total_quota IS NULL OR total_quota BETWEEN 1 AND 100000),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_buy_items_campaign_idx ON public.group_buy_items(campaign_id, sort_order);

CREATE TABLE IF NOT EXISTS public.group_buy_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_no text NOT NULL UNIQUE CHECK (order_no ~ '^GB[0-9]{14}$'),
  campaign_id bigint NOT NULL REFERENCES public.group_buy_campaigns(id),
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 20),
  phone text NOT NULL CHECK (phone ~ '^09[0-9]{8}$'),
  shipping_method text NOT NULL CHECK (shipping_method IN ('711', 'home')),
  store_id bigint,
  store_code text,
  store_name text,
  store_address text,
  home_address text CHECK (home_address IS NULL OR char_length(home_address) BETWEEN 8 AND 200),
  delivery_time text CHECK (delivery_time IS NULL OR delivery_time IN ('不指定', '13點前', '14-18點')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 200),
  subtotal integer NOT NULL CHECK (subtotal > 0),
  shipping_fee integer NOT NULL CHECK (shipping_fee >= 0),
  total_amount integer NOT NULL,
  status text NOT NULL DEFAULT '待出貨' CHECK (status IN ('待出貨', '已出貨', '已完成', '已取消')),
  admin_note text NOT NULL DEFAULT '' CHECK (char_length(admin_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_amount = subtotal + shipping_fee),
  CHECK (shipping_method <> '711' OR (store_id IS NOT NULL AND store_name IS NOT NULL)),
  CHECK (shipping_method <> 'home' OR home_address IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS group_buy_orders_campaign_idx ON public.group_buy_orders(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_buy_orders_phone_idx ON public.group_buy_orders(phone);

CREATE TABLE IF NOT EXISTS public.group_buy_order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.group_buy_orders(id) ON DELETE CASCADE,
  item_id bigint NOT NULL REFERENCES public.group_buy_items(id),
  name_snapshot text NOT NULL,
  spec_snapshot text NOT NULL DEFAULT '',
  unit_price integer NOT NULL CHECK (unit_price > 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  subtotal integer NOT NULL,
  CHECK (subtotal = unit_price * quantity)
);
CREATE INDEX IF NOT EXISTS group_buy_order_items_order_idx ON public.group_buy_order_items(order_id);
CREATE INDEX IF NOT EXISTS group_buy_order_items_item_idx ON public.group_buy_order_items(item_id);


-- ── 統計：已售數量、跟團人數（不含已取消） ──────────────
CREATE OR REPLACE VIEW public.group_buy_item_stats WITH (security_invoker = true) AS
SELECT oi.item_id, sum(oi.quantity)::bigint AS sold
FROM public.group_buy_order_items oi
JOIN public.group_buy_orders o ON o.id = oi.order_id
WHERE o.status <> '已取消'
GROUP BY oi.item_id;

CREATE OR REPLACE VIEW public.group_buy_campaign_stats WITH (security_invoker = true) AS
SELECT campaign_id, count(DISTINCT phone)::bigint AS buyers, count(*)::bigint AS orders
FROM public.group_buy_orders
WHERE status <> '已取消'
GROUP BY campaign_id;


-- ── 下單 ────────────────────────────────────────────────
-- 一個交易裡完成所有檢查再寫入；任何一項不符整張單不成立。
-- 金額只在這裡算：前台傳來的只有「哪個商品、幾件」，價格、運費一律以資料庫為準。
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

  IF p_shipping_method = '711' THEN
    IF NOT c.ship_711_enabled THEN RAISE EXCEPTION '這一檔沒有開放 7-11 取貨'; END IF;
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

  v_fee := CASE WHEN p_shipping_method = '711' THEN c.fee_711 ELSE c.fee_home END;
  IF c.free_shipping_threshold IS NOT NULL AND v_subtotal >= c.free_shipping_threshold THEN v_fee := 0; END IF;

  INSERT INTO group_buy_orders(order_no, campaign_id, customer_name, phone, shipping_method,
      store_id, store_code, store_name, store_address, home_address, delivery_time, note,
      subtotal, shipping_fee, total_amount)
  VALUES (p_order_no, c.id, trim(p_customer_name), p_phone, p_shipping_method,
      CASE WHEN p_shipping_method = '711' THEN v_store.id END,
      CASE WHEN p_shipping_method = '711' THEN v_store.store_code END,
      CASE WHEN p_shipping_method = '711' THEN v_store.store_name END,
      CASE WHEN p_shipping_method = '711' THEN v_store.address END,
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


-- ── 權限：只有網站伺服器能讀寫 ─────────────────────────
ALTER TABLE public.group_buy_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_buy_campaigns, public.group_buy_items, public.group_buy_orders, public.group_buy_order_items,
  public.group_buy_item_stats, public.group_buy_campaign_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_buy_campaigns, public.group_buy_items,
  public.group_buy_orders, public.group_buy_order_items TO service_role;
GRANT SELECT ON public.group_buy_item_stats, public.group_buy_campaign_stats TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.group_buy_campaigns_id_seq, public.group_buy_items_id_seq,
  public.group_buy_orders_id_seq, public.group_buy_order_items_id_seq TO service_role;
REVOKE ALL ON FUNCTION public.place_group_buy_order(text, text, text, text, text, bigint, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_group_buy_order(text, text, text, text, text, bigint, text, text, text, jsonb) TO service_role;

COMMIT;

SELECT '團購資料表已建立' AS 結果;
