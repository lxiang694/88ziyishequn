-- ═══════════════════════════════════════════════════════════
-- 賣貨便轉單：跨賣場訂單自動拆單
--
-- 冪等，可重複執行。請在 myship_transfer.sql 之後執行
-- （myship_confirm_recovery.sql 有沒有跑過都可以，本檔會完整取代確認函式）。
--
-- 一張健康優選訂單的商品分屬兩個賣場時，拆成兩張賣貨便訂單，各自匯出、
-- 各自代收自己那個賣場的商品金額。
--
-- 原本的設計刻意禁止拆單，防的是「重複代收」：天真地拆，每張都填原訂單
-- 總額，客人就被收兩次錢。這個擔心在這裡用資料庫層的檢查接手：
--   • 每張代收金額必須等於該賣場商品的小計加總（不是訂單總額）
--   • 拆成幾張必須等於商品實際分屬的賣場數
--   • 同一張訂單已匯出的其他張，必須是用同一種拆法匯出的
-- 應用程式算錯任何一項，這裡都會整批拒絕。
--
-- 程式碼可以比本檔先上線：本檔沒跑之前，舊的檢查會把拆單擋下（安全的
-- 失敗），單一賣場的訂單完全照舊。
-- ═══════════════════════════════════════════════════════════
BEGIN;

-- ── 拆單序號 ────────────────────────────────────────────
-- 既有的轉單都是沒拆的，預設值 1/1 正好描述它們。
ALTER TABLE myship_transfers ADD COLUMN IF NOT EXISTS part_no int NOT NULL DEFAULT 1;
ALTER TABLE myship_transfers ADD COLUMN IF NOT EXISTS part_count int NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myship_transfers_part_chk') THEN
    ALTER TABLE myship_transfers ADD CONSTRAINT myship_transfers_part_chk
      CHECK (part_count BETWEEN 1 AND 9 AND part_no BETWEEN 1 AND part_count);
  END IF;
END $$;


-- ── 有效轉單的唯一性 ────────────────────────────────────
-- 原本是「一張訂單只能有一筆有效轉單」，拆單後同一張訂單在每個賣場各有一筆。
-- 改成按「訂單＋賣場」唯一：同一半仍然不能重複匯出。
-- 新條件比舊的寬，既有資料一定符合，建立索引不會失敗。
DROP INDEX IF EXISTS myship_transfers_active_order;
CREATE UNIQUE INDEX IF NOT EXISTS myship_transfers_active_order_market
  ON myship_transfers(order_id, marketplace_id) WHERE status <> 'released';
-- 同一張訂單的兩半不能佔用同一個序號
CREATE UNIQUE INDEX IF NOT EXISTS myship_transfers_active_order_part
  ON myship_transfers(order_id, part_no) WHERE status <> 'released';


-- ── 保留批次 ────────────────────────────────────────────
-- 交易內逐筆鎖定、比對快照，再保留匯出紀錄；任一衝突整批回滾。
CREATE OR REPLACE FUNCTION myship_reserve_batch(p_batch_id uuid,p_entries jsonb,p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE entry jsonb; current_order orders%ROWTYPE; target_market text;
  v_part_no int; v_part_count int; v_markets int; v_amount bigint; v_row_amount text;
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

    -- 每個商品都要有賣場，否則不知道該拆到哪
    IF EXISTS(SELECT 1 FROM order_items i LEFT JOIN myship_variant_mappings m ON m.variant_id=i.variant_id
      WHERE i.order_id=current_order.id AND m.marketplace_id IS NULL) THEN
      RAISE EXCEPTION '商品賣場配對已改變';
    END IF;

    -- 沒帶拆單資訊的（舊版助手）視為沒拆單 1/1
    v_part_no := COALESCE((entry->>'part_no')::int, 1);
    v_part_count := COALESCE((entry->>'part_count')::int, 1);
    IF v_part_no < 1 OR v_part_no > v_part_count THEN RAISE EXCEPTION '拆單序號錯誤'; END IF;

    -- 拆成幾張必須等於商品實際分屬的賣場數。少拆就會有商品被漏掉
    -- 沒寄、也沒收錢；多拆則是不存在的一張。
    SELECT count(DISTINCT m.marketplace_id) INTO v_markets
      FROM order_items i JOIN myship_variant_mappings m ON m.variant_id=i.variant_id
      WHERE i.order_id=current_order.id;
    IF v_markets <> v_part_count THEN RAISE EXCEPTION '商品賣場配對已改變'; END IF;

    IF NOT EXISTS(SELECT 1 FROM order_items i JOIN myship_variant_mappings m ON m.variant_id=i.variant_id
      WHERE i.order_id=current_order.id AND m.marketplace_id=target_market) THEN
      RAISE EXCEPTION '商品賣場配對已改變';
    END IF;

    -- 代收金額：必須剛好等於這個賣場商品的小計加總。
    -- 這是防「重複代收」的最後一道關 —— 不拆單時它就等於訂單總額，
    -- 所以原本的訂單照樣通過；拆單時每張只能收自己那部分。
    SELECT sum(i.subtotal) INTO v_amount
      FROM order_items i JOIN myship_variant_mappings m ON m.variant_id=i.variant_id
      WHERE i.order_id=current_order.id AND m.marketplace_id=target_market;
    v_row_amount := entry->'row'->>5;
    IF v_row_amount IS NULL OR v_row_amount !~ '^[0-9]+$' OR v_row_amount::bigint <> v_amount THEN
      RAISE EXCEPTION '代收金額與商品小計不符';
    END IF;

    -- 同一張訂單已經匯出的其他張，必須是同一種拆法。
    -- 情境：訂單原本整張在 A 賣場匯出（代收全額），之後有商品改配到 B 賣場，
    -- 系統現在會想把它拆成兩張 —— 若放行 B 那張，B 的商品就被收了兩次錢。
    IF EXISTS(SELECT 1 FROM myship_transfers
      WHERE order_id=current_order.id AND status <> 'released' AND part_count <> v_part_count) THEN
      RAISE EXCEPTION '此訂單已有依不同拆單方式匯出的轉單，請先核對或解除保留';
    END IF;

    INSERT INTO myship_transfers(order_id,marketplace_id,batch_id,snapshot,import_row,created_by,part_no,part_count)
    VALUES(current_order.id,target_market,p_batch_id,entry->'snapshot',entry->'row',p_admin_id,v_part_no,v_part_count);
  END LOOP;
END;
$$;


-- ── 確認出貨 ────────────────────────────────────────────
-- 以 myship_confirm_recovery.sql 的版本為基礎（可補記已人工出貨的訂單），
-- 多了一條：拆單的訂單要每一張都確認了，整張訂單才改成已出貨。
--
-- 為什麼不能第一張確認就改狀態：轉單清單只抓「待確認」的訂單。第一張一確認
-- 就改成已出貨，另一張會從清單消失，永遠匯不出去。
CREATE OR REPLACE FUNCTION myship_confirm_transfer(p_transfer_id uuid,p_external_order_no text,p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE transfer myship_transfers%ROWTYPE; current_order orders%ROWTYPE; current_snapshot jsonb; v_confirmed int;
BEGIN
  IF p_external_order_no IS NULL OR p_external_order_no !~ '^CM[0-9]{13}$' THEN RAISE EXCEPTION '請填入CM開頭的賣貨便訂單編號'; END IF;
  SELECT * INTO transfer FROM myship_transfers WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '轉單紀錄不存在'; END IF;
  IF transfer.status='confirmed' THEN
    IF transfer.external_order_no=p_external_order_no THEN RETURN; END IF;
    RAISE EXCEPTION '此訂單已記錄其他賣貨便編號';
  END IF;
  IF transfer.status <> 'exported' THEN RAISE EXCEPTION '此批次已解除保留'; END IF;
  -- 鎖住訂單。拆單的兩張若同時確認，會在這裡排隊，下面的「是否全部確認」
  -- 計數才不會兩邊都看到對方還沒確認、結果誰都沒把訂單改成已出貨。
  SELECT * INTO current_order FROM orders WHERE id=transfer.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '原訂單不存在'; END IF;
  IF current_order.order_status IS NULL OR current_order.order_status NOT IN ('待確認','已出貨') THEN
    RAISE EXCEPTION '原訂單狀態不允許回填';
  END IF;
  PERFORM 1 FROM order_items WHERE order_id=transfer.order_id ORDER BY id FOR UPDATE;
  current_snapshot := myship_order_snapshot(transfer.order_id);
  -- 只排除人工出貨會變動的狀態和更新時間，其餘訂單欄位及全部品項仍須一致。
  IF ((current_snapshot->'order') - 'order_status' - 'updated_at') IS DISTINCT FROM ((transfer.snapshot->'order') - 'order_status' - 'updated_at')
     OR current_snapshot->'items' IS DISTINCT FROM transfer.snapshot->'items' THEN
    RAISE EXCEPTION '原訂單內容已改變，請人工核對';
  END IF;
  UPDATE myship_transfers SET status='confirmed',external_order_no=p_external_order_no,confirmed_by=p_admin_id,confirmed_at=now() WHERE id=p_transfer_id;

  -- 同一種拆法、已確認的張數。不拆單時 part_count=1，確認這一張就滿足，
  -- 行為跟原本完全一樣。
  SELECT count(DISTINCT marketplace_id) INTO v_confirmed FROM myship_transfers
    WHERE order_id=transfer.order_id AND status='confirmed' AND part_count=transfer.part_count;
  IF current_order.order_status='待確認' AND v_confirmed >= transfer.part_count THEN
    UPDATE orders SET order_status='已出貨',updated_at=now() WHERE id=transfer.order_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION myship_reserve_batch(uuid,jsonb,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION myship_confirm_transfer(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION myship_reserve_batch(uuid,jsonb,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION myship_confirm_transfer(uuid,text,bigint) TO service_role;
COMMIT;
