-- ═══════════════════════════════════════════════════════════
-- 賣貨便轉單：加入團購訂單
--
-- 冪等，可重複執行。請在下列遷移之後執行：
--   myship_transfer.sql、myship_split_orders.sql、group_buy_schema.sql、
--   group_buy_711_normal.sql
--
-- 規則：
--   • 只有「待出貨」且「7-11 取貨」的團購訂單能轉（黑貓宅配不走賣貨便）
--   • 依溫層對應賣場：7-11 冷凍 → 冷凍賣場；7-11 常溫 → 常溫賣場
--   • 代收金額 = 團購訂單應收總額（商品＋運費），運費欄填 0，與一般訂單同一套做法
--   • 不拆單：一張團購訂單 = 一張賣貨便訂單
--   • 賣貨便核對成功後，團購訂單改成「已出貨」
--
-- 程式碼可以比本檔先上線：本檔沒跑之前，團購那一頁會提示先執行本檔，
-- 一般訂單的轉單完全不受影響。
-- ═══════════════════════════════════════════════════════════
BEGIN;

-- ── 轉單紀錄：區分一般訂單／團購訂單 ─────────────────────
ALTER TABLE myship_transfers ADD COLUMN IF NOT EXISTS part_no int NOT NULL DEFAULT 1;
ALTER TABLE myship_transfers ADD COLUMN IF NOT EXISTS part_count int NOT NULL DEFAULT 1;
-- source 另外存：團購訂單被刪除時 group_buy_order_id 會變成 NULL，仍看得出這筆是團購
ALTER TABLE myship_transfers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'shop';
ALTER TABLE myship_transfers ADD COLUMN IF NOT EXISTS group_buy_order_id bigint
  REFERENCES public.group_buy_orders(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myship_transfers_source_chk') THEN
    ALTER TABLE myship_transfers ADD CONSTRAINT myship_transfers_source_chk CHECK (
      source IN ('shop', 'group_buy')
      AND NOT (order_id IS NOT NULL AND group_buy_order_id IS NOT NULL)
      AND (source = 'group_buy' OR group_buy_order_id IS NULL)
      AND (source = 'shop' OR order_id IS NULL));
  END IF;
END $$;

-- 一張團購訂單同時只能有一筆有效轉單
CREATE UNIQUE INDEX IF NOT EXISTS myship_transfers_active_group_buy
  ON myship_transfers(group_buy_order_id) WHERE status <> 'released' AND group_buy_order_id IS NOT NULL;


-- ── 團購訂單快照 ─────────────────────────────────────────
-- 只放出貨會用到的欄位。狀態、內部備註、更新時間不放：後台改內部備註
-- 不該讓已匯出的轉單變成「訂單內容已改變」。
CREATE OR REPLACE FUNCTION myship_group_buy_snapshot(p_id bigint) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'order', jsonb_build_object(
      'order_no', o.order_no, 'campaign_id', o.campaign_id, 'customer_name', o.customer_name, 'phone', o.phone,
      'shipping_method', o.shipping_method, 'store_id', o.store_id, 'store_code', o.store_code,
      'store_name', o.store_name, 'store_address', o.store_address, 'note', o.note,
      'subtotal', o.subtotal, 'shipping_fee', o.shipping_fee, 'total_amount', o.total_amount, 'created_at', o.created_at),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'item_id', i.item_id, 'name_snapshot', i.name_snapshot, 'spec_snapshot', i.spec_snapshot,
        'unit_price', i.unit_price, 'quantity', i.quantity, 'subtotal', i.subtotal) ORDER BY i.id)
      FROM group_buy_order_items i WHERE i.order_id = o.id), '[]'::jsonb))
  FROM group_buy_orders o WHERE o.id = p_id;
$$;

-- 重新下載批次時一次核對多筆
CREATE OR REPLACE FUNCTION myship_group_buy_snapshots(p_ids bigint[]) RETURNS TABLE (id bigint, snapshot jsonb)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT o.id, myship_group_buy_snapshot(o.id) FROM group_buy_orders o WHERE o.id = ANY(p_ids);
$$;


-- ── 保留團購批次 ─────────────────────────────────────────
-- p_entries：[{ group_buy_order_id, marketplace_id, row }]
-- 匯入列由伺服器依當下資料產生；這裡再逐欄比對訂單現況，任一不符整批回滾。
CREATE OR REPLACE FUNCTION myship_reserve_group_buy_batch(p_batch_id uuid, p_entries jsonb, p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE entry jsonb; o group_buy_orders%ROWTYPE; v_market myship_marketplaces%ROWTYPE;
  v_store_code text; v_temp text; v_row jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_batch_id::text, 0));
  IF EXISTS(SELECT 1 FROM myship_transfers WHERE batch_id = p_batch_id) THEN
    RAISE EXCEPTION '此批次已建立，請讀取原批次';
  END IF;
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '每批需為1至500筆';
  END IF;
  IF (SELECT count(DISTINCT value->>'marketplace_id') FROM jsonb_array_elements(p_entries)) <> 1 THEN
    RAISE EXCEPTION '每批請只選擇同一個賣場';
  END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) ORDER BY (value->>'group_buy_order_id')::bigint LOOP
    SELECT * INTO o FROM group_buy_orders WHERE id = (entry->>'group_buy_order_id')::bigint FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '團購訂單不存在'; END IF;
    IF o.status <> '待出貨' THEN RAISE EXCEPTION '%：團購訂單已不是待出貨', o.order_no; END IF;
    IF o.shipping_method NOT IN ('711', '711_normal') THEN RAISE EXCEPTION '%：不是 7-11 取貨', o.order_no; END IF;
    v_temp := CASE o.shipping_method WHEN '711' THEN '冷凍' ELSE '常溫' END;

    SELECT * INTO v_market FROM myship_marketplaces WHERE id = entry->>'marketplace_id' AND enabled FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION '賣場未啟用'; END IF;
    IF v_market.temperature <> v_temp THEN RAISE EXCEPTION '%：溫層不符（訂單是%，賣場是%）', o.order_no, v_temp, v_market.temperature; END IF;

    SELECT store_code INTO v_store_code FROM stores_711 WHERE id = o.store_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION '%：門市不存在或已停用', o.order_no; END IF;

    -- 逐欄比對：收件人、手機、門市、溫層、代收金額、運費、原單標記
    v_row := entry->'row';
    IF jsonb_typeof(v_row) <> 'array' OR jsonb_array_length(v_row) <> 10
       OR v_row->>0 <> btrim(o.customer_name) OR v_row->>1 <> o.phone OR v_row->>2 <> v_store_code
       OR v_row->>3 <> v_temp OR v_row->>5 <> o.total_amount::text OR v_row->>6 <> '0'
       OR v_row->>9 <> '健康優選團購：' || o.order_no THEN
      RAISE EXCEPTION '%：訂單內容已改變，請重新整理', o.order_no;
    END IF;

    IF EXISTS(SELECT 1 FROM myship_transfers WHERE group_buy_order_id = o.id AND status <> 'released') THEN
      RAISE EXCEPTION '%：已經匯出過，請到批次紀錄核對', o.order_no;
    END IF;

    INSERT INTO myship_transfers(source, group_buy_order_id, order_id, marketplace_id, batch_id, snapshot, import_row, created_by, part_no, part_count)
    VALUES('group_buy', o.id, NULL, v_market.id, p_batch_id, myship_group_buy_snapshot(o.id), v_row, p_admin_id, 1, 1);
  END LOOP;
END;
$$;


-- ── 確認出貨（一般訂單＋團購訂單）─────────────────────────
-- 一般訂單的部分與 myship_split_orders.sql 的版本完全相同；團購訂單另走一段。
CREATE OR REPLACE FUNCTION myship_confirm_transfer(p_transfer_id uuid,p_external_order_no text,p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE transfer myship_transfers%ROWTYPE; current_order orders%ROWTYPE; current_snapshot jsonb; v_confirmed int;
  gb group_buy_orders%ROWTYPE;
BEGIN
  IF p_external_order_no IS NULL OR p_external_order_no !~ '^CM[0-9]{13}$' THEN RAISE EXCEPTION '請填入CM開頭的賣貨便訂單編號'; END IF;
  SELECT * INTO transfer FROM myship_transfers WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '轉單紀錄不存在'; END IF;
  IF transfer.status='confirmed' THEN
    IF transfer.external_order_no=p_external_order_no THEN RETURN; END IF;
    RAISE EXCEPTION '此訂單已記錄其他賣貨便編號';
  END IF;
  IF transfer.status <> 'exported' THEN RAISE EXCEPTION '此批次已解除保留'; END IF;

  -- 團購訂單
  IF transfer.source = 'group_buy' THEN
    SELECT * INTO gb FROM group_buy_orders WHERE id = transfer.group_buy_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '原團購訂單不存在'; END IF;
    -- 已出貨也放行：後台可能已經先手動改成已出貨，這裡只是補記賣貨便編號
    IF gb.status NOT IN ('待出貨', '已出貨') THEN RAISE EXCEPTION '原團購訂單狀態不允許回填'; END IF;
    IF myship_group_buy_snapshot(gb.id) IS DISTINCT FROM transfer.snapshot THEN
      RAISE EXCEPTION '原團購訂單內容已改變，請人工核對';
    END IF;
    UPDATE myship_transfers SET status='confirmed',external_order_no=p_external_order_no,confirmed_by=p_admin_id,confirmed_at=now() WHERE id=p_transfer_id;
    UPDATE group_buy_orders SET status='已出貨', updated_at=now() WHERE id=gb.id AND status='待出貨';
    RETURN;
  END IF;

  -- 一般訂單（同 myship_split_orders.sql）
  SELECT * INTO current_order FROM orders WHERE id=transfer.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '原訂單不存在'; END IF;
  IF current_order.order_status IS NULL OR current_order.order_status NOT IN ('待確認','已出貨') THEN
    RAISE EXCEPTION '原訂單狀態不允許回填';
  END IF;
  PERFORM 1 FROM order_items WHERE order_id=transfer.order_id ORDER BY id FOR UPDATE;
  current_snapshot := myship_order_snapshot(transfer.order_id);
  IF ((current_snapshot->'order') - 'order_status' - 'updated_at') IS DISTINCT FROM ((transfer.snapshot->'order') - 'order_status' - 'updated_at')
     OR current_snapshot->'items' IS DISTINCT FROM transfer.snapshot->'items' THEN
    RAISE EXCEPTION '原訂單內容已改變，請人工核對';
  END IF;
  UPDATE myship_transfers SET status='confirmed',external_order_no=p_external_order_no,confirmed_by=p_admin_id,confirmed_at=now() WHERE id=p_transfer_id;
  SELECT count(DISTINCT marketplace_id) INTO v_confirmed FROM myship_transfers
    WHERE order_id=transfer.order_id AND status='confirmed' AND part_count=transfer.part_count;
  IF current_order.order_status='待確認' AND v_confirmed >= transfer.part_count THEN
    UPDATE orders SET order_status='已出貨',updated_at=now() WHERE id=transfer.order_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION myship_group_buy_snapshot(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION myship_group_buy_snapshots(bigint[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION myship_reserve_group_buy_batch(uuid,jsonb,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION myship_confirm_transfer(uuid,text,bigint) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION myship_group_buy_snapshot(bigint), myship_group_buy_snapshots(bigint[]),
      myship_reserve_group_buy_batch(uuid,jsonb,bigint), myship_confirm_transfer(uuid,text,bigint) FROM anon, authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION myship_group_buy_snapshot(bigint), myship_group_buy_snapshots(bigint[]),
      myship_reserve_group_buy_batch(uuid,jsonb,bigint), myship_confirm_transfer(uuid,text,bigint) TO service_role';
  END IF;
END $$;
COMMIT;

-- 確認：應該看得到 source 與 group_buy_order_id 兩個欄位
SELECT column_name FROM information_schema.columns
WHERE table_name = 'myship_transfers' AND column_name IN ('source', 'group_buy_order_id');

-- ⚠️ 團購有 7-11「冷凍」取貨的話，需要一個溫層是「冷凍」的賣貨便賣場。
--    還沒有的話，複製 migrations/myship_add_marketplace.sql，把 temperature 改成 '冷凍'。
SELECT id, name, temperature, enabled FROM myship_marketplaces ORDER BY temperature, id;
