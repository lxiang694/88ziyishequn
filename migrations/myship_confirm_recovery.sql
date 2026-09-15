-- 修正已人工出貨的轉單回填；不修改任何訂單或現有批次資料。
BEGIN;
CREATE OR REPLACE FUNCTION myship_confirm_transfer(p_transfer_id uuid,p_external_order_no text,p_admin_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE transfer myship_transfers%ROWTYPE; current_order orders%ROWTYPE; current_snapshot jsonb;
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
  IF current_order.order_status='待確認' THEN
    UPDATE orders SET order_status='已出貨',updated_at=now() WHERE id=transfer.order_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION myship_confirm_transfer(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION myship_confirm_transfer(uuid,text,bigint) TO service_role;
COMMIT;
