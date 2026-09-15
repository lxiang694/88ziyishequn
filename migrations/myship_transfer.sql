-- 先在測試資料庫執行。僅服務端 service_role 可存取轉單資料。
BEGIN;
CREATE TABLE IF NOT EXISTS myship_marketplaces (
  id text PRIMARY KEY CHECK (id ~ '^GM[0-9]+$'),
  name text NOT NULL,
  temperature text NOT NULL DEFAULT '常溫' CHECK (temperature IN ('常溫','冷凍')),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO myship_marketplaces(id,name,enabled)
VALUES ('GM2601252733206','小莊備用88',true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS myship_variant_mappings (
  variant_id bigint PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  marketplace_id text NOT NULL REFERENCES myship_marketplaces(id)
);
CREATE TABLE IF NOT EXISTS myship_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id bigint REFERENCES orders(id) ON DELETE SET NULL,
  marketplace_id text NOT NULL REFERENCES myship_marketplaces(id),
  batch_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  import_row jsonb NOT NULL CHECK (jsonb_typeof(import_row) = 'array' AND jsonb_array_length(import_row) = 10),
  status text NOT NULL DEFAULT 'exported' CHECK (status IN ('exported','confirmed','released')),
  external_order_no text UNIQUE,
  created_by bigint NOT NULL,
  confirmed_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  release_reason text,
  released_by bigint,
  released_at timestamptz,
  CHECK ((status IN ('exported','released') AND external_order_no IS NULL AND confirmed_at IS NULL)
    OR (status = 'confirmed' AND external_order_no IS NOT NULL AND external_order_no ~ '^CM[0-9]{13}$' AND confirmed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS myship_transfers_active_order ON myship_transfers(order_id) WHERE status <> 'released';
CREATE INDEX IF NOT EXISTS myship_transfers_batch ON myship_transfers(batch_id);
ALTER TABLE myship_marketplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE myship_variant_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE myship_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON myship_marketplaces,myship_variant_mappings,myship_transfers FROM anon,authenticated;
GRANT ALL ON myship_marketplaces,myship_variant_mappings,myship_transfers TO service_role;

CREATE OR REPLACE FUNCTION myship_order_snapshot(p_order_id bigint) RETURNS jsonb
LANGUAGE sql SET search_path = public AS $$
  SELECT jsonb_build_object('order',to_jsonb(o),'items',COALESCE(
    (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM order_items i WHERE i.order_id=o.id),'[]'::jsonb))
  FROM orders o WHERE o.id=p_order_id;
$$;

-- 交易內逐筆鎖定、比對快照，再保留匯出紀錄；任一衝突整批回滾。
CREATE OR REPLACE FUNCTION myship_reserve_batch(p_batch_id uuid,p_entries jsonb,p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE entry jsonb; current_order orders%ROWTYPE; target_market text;
BEGIN
  -- 同一批次的並行請求不可混入另一組訂單。
  PERFORM pg_advisory_xact_lock(hashtextextended(p_batch_id::text, 0));
  IF EXISTS(SELECT 1 FROM myship_transfers WHERE batch_id=p_batch_id) THEN
    RAISE EXCEPTION '此批次已建立，請讀取原批次';
  END IF;
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '每批需為1至500筆';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) ORDER BY (value->>'order_id')::bigint LOOP
    SELECT * INTO current_order FROM orders WHERE id=(entry->>'order_id')::bigint FOR UPDATE;
    IF NOT FOUND OR current_order.order_status <> '待確認' THEN RAISE EXCEPTION '訂單狀態已改變'; END IF;
    IF myship_order_snapshot(current_order.id) IS DISTINCT FROM entry->'snapshot' THEN RAISE EXCEPTION '訂單內容已改變，請重新整理'; END IF;
    target_market := entry->>'marketplace_id';
    PERFORM 1 FROM myship_marketplaces WHERE id=target_market AND enabled FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION '賣場未啟用'; END IF;
    IF EXISTS(SELECT 1 FROM order_items i LEFT JOIN myship_variant_mappings m ON m.variant_id=i.variant_id
      WHERE i.order_id=current_order.id AND m.marketplace_id IS DISTINCT FROM target_market) THEN
      RAISE EXCEPTION '商品賣場配對已改變';
    END IF;
    INSERT INTO myship_transfers(order_id,marketplace_id,batch_id,snapshot,import_row,created_by)
    VALUES(current_order.id,target_market,p_batch_id,entry->'snapshot',entry->'row',p_admin_id);
  END LOOP;
END;
$$;

-- 管理員人工核對成功編號後呼叫。寫入編號與更新訂單於同一交易完成。
CREATE OR REPLACE FUNCTION myship_confirm_transfer(p_transfer_id uuid,p_external_order_no text,p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE transfer myship_transfers%ROWTYPE; current_order orders%ROWTYPE;
BEGIN
  IF p_external_order_no IS NULL OR p_external_order_no !~ '^CM[0-9]{13}$' THEN RAISE EXCEPTION '請填入CM開頭的賣貨便訂單編號'; END IF;
  SELECT * INTO transfer FROM myship_transfers WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '轉單紀錄不存在'; END IF;
  IF transfer.status='confirmed' THEN
    IF transfer.external_order_no=p_external_order_no THEN RETURN; END IF;
    RAISE EXCEPTION '此訂單已記錄其他賣貨便編號';
  END IF;
  IF transfer.status <> 'exported' THEN RAISE EXCEPTION '此批次已解除保留'; END IF;
  SELECT * INTO current_order FROM orders WHERE id=transfer.order_id FOR UPDATE;
  IF NOT FOUND OR current_order.order_status <> '待確認' THEN RAISE EXCEPTION '原訂單狀態已改變，請人工核對'; END IF;
  IF myship_order_snapshot(transfer.order_id) IS DISTINCT FROM transfer.snapshot THEN RAISE EXCEPTION '原訂單內容已改變，請人工核對'; END IF;
  UPDATE myship_transfers SET status='confirmed',external_order_no=p_external_order_no,confirmed_by=p_admin_id,confirmed_at=now() WHERE id=p_transfer_id;
  UPDATE orders SET order_status='已出貨',updated_at=now() WHERE id=transfer.order_id;
END;
$$;
CREATE OR REPLACE FUNCTION myship_release_transfer(p_transfer_id uuid,p_reason text,p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE transfer myship_transfers%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 200 THEN RAISE EXCEPTION '請填寫核對原因'; END IF;
  SELECT * INTO transfer FROM myship_transfers WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND OR transfer.status <> 'exported' THEN RAISE EXCEPTION '只有未確認的轉單可解除保留'; END IF;
  UPDATE myship_transfers SET status='released',release_reason=trim(p_reason),released_by=p_admin_id,released_at=now() WHERE id=p_transfer_id;
END;
$$;
REVOKE ALL ON FUNCTION myship_order_snapshot(bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION myship_reserve_batch(uuid,jsonb,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION myship_confirm_transfer(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION myship_release_transfer(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION myship_order_snapshot(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION myship_reserve_batch(uuid,jsonb,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION myship_confirm_transfer(uuid,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION myship_release_transfer(uuid,text,bigint) TO service_role;
COMMIT;
