-- 批次清理已停用門市。訂單曾使用的門市一律保留。
CREATE OR REPLACE FUNCTION public.delete_inactive_stores(
  p_ids bigint[] DEFAULT '{}', p_all boolean DEFAULT false, p_q text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_used bigint[] := '{}';
  v_matched integer;
  v_deleted integer;
BEGIN
  SET LOCAL lock_timeout = '3s';
  SET LOCAL statement_timeout = '10s';
  IF p_ids IS NULL OR p_all IS NULL OR p_q IS NULL
    OR (NOT p_all AND (cardinality(p_ids) = 0 OR cardinality(p_ids) > 500))
    OR EXISTS (SELECT 1 FROM unnest(p_ids) id WHERE id IS NULL OR id <= 0)
    OR (p_all AND cardinality(p_ids) > 0) THEN
    RAISE EXCEPTION '門市選取格式錯誤';
  END IF;
  -- 與門市啟用、訂單寫入互斥，檢查到刪除之間不會新增引用。
  -- 鎖定逾時時整筆回滾，營運人員可稍後重試。
  LOCK TABLE public.stores_711 IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.orders IN SHARE MODE;
  IF to_regclass('public.group_buy_orders') IS NOT NULL THEN
    LOCK TABLE public.group_buy_orders IN SHARE MODE;
    EXECUTE 'SELECT coalesce(array_agg(DISTINCT store_id), ''{}''::bigint[])
      FROM public.group_buy_orders WHERE store_id IS NOT NULL' INTO v_used;
  END IF;
  SELECT count(*) INTO v_matched FROM public.stores_711 s
    WHERE s.is_active = false AND (p_all OR s.id = ANY(p_ids))
      AND (NOT p_all OR p_q = '' OR
        CASE WHEN p_q ~ '^[0-9]{3,6}$' THEN s.store_code LIKE p_q || '%'
        ELSE s.store_name ILIKE '%' || p_q || '%' OR s.address ILIKE '%' || p_q || '%' END);
  DELETE FROM public.stores_711 s
    WHERE s.is_active = false AND (p_all OR s.id = ANY(p_ids))
      AND (NOT p_all OR p_q = '' OR
        CASE WHEN p_q ~ '^[0-9]{3,6}$' THEN s.store_code LIKE p_q || '%'
        ELSE s.store_name ILIKE '%' || p_q || '%' OR s.address ILIKE '%' || p_q || '%' END)
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.store_id = s.id)
      AND NOT (s.id = ANY(v_used));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('deleted', v_deleted, 'skipped',
    CASE WHEN p_all THEN v_matched ELSE cardinality(p_ids) END - v_deleted);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_inactive_stores(bigint[], boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inactive_stores(bigint[], boolean, text) TO service_role;
