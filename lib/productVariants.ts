/**
 * 後台儲存商品規格。
 *
 * ── 為什麼刪不掉 ────────────────────────────────────────
 * 訂單明細（order_items）連著規格。賣過的規格一刪，舊訂單就對不到買了什麼，
 * 資料庫會拒絕（外鍵錯誤 23503）。以前這裡沒檢查結果：刪除失敗也照樣回「已更新」，
 * 後台以為刪掉了，前台卻一直還在。
 *
 * ── 現在怎麼做 ──────────────────────────────────────────
 * 一個一個刪：沒賣過的真的刪掉；被訂單連著的改成「下架」（is_active = false），
 * 前台就不再顯示，舊訂單、報表照常。回傳哪些是改下架的，讓後台講清楚。
 * 新增、修改失敗也要回報，不再假裝成功。
 */
interface Db { from: (table: string) => any }

export interface VariantInput {
  id?: number | null
  variant_name: string
  sale_price: unknown
  original_price?: unknown
  stock_qty?: unknown
  sku_code?: string | null
  is_active?: boolean
}

export async function saveVariants(db: Db, productId: number, variants: VariantInput[]): Promise<{ retired: string[]; error?: string }> {
  const { data: existing, error: readErr } = await db.from('product_variants').select('id, variant_name').eq('product_id', productId)
  if (readErr) return { retired: [], error: '讀取原本的規格失敗' }
  const keep = new Set(variants.filter(v => v.id).map(v => Number(v.id)))
  const removed = ((existing || []) as { id: number; variant_name: string }[]).filter(v => !keep.has(v.id))

  const retired: string[] = []
  for (const v of removed) {
    const { error } = await db.from('product_variants').delete().eq('id', v.id)
    if (!error) continue
    if (error.code !== '23503') return { retired, error: `刪除規格「${v.variant_name}」失敗` }
    // 有訂單連著：改成下架
    const { error: offErr } = await db.from('product_variants').update({ is_active: false }).eq('id', v.id)
    if (offErr) return { retired, error: `規格「${v.variant_name}」有訂單，改下架也失敗了` }
    retired.push(v.variant_name)
  }

  for (const [i, v] of variants.entries()) {
    const row = {
      product_id: productId,
      variant_name: v.variant_name,
      sale_price: parseFloat(String(v.sale_price)) || 0,
      original_price: v.original_price ? parseFloat(String(v.original_price)) : null,
      stock_qty: parseInt(String(v.stock_qty)) || 0,
      sku_code: v.sku_code || null,
      sort_order: i,
      is_active: v.is_active !== false,
    }
    const { error } = v.id
      ? await db.from('product_variants').update(row).eq('id', v.id)
      : await db.from('product_variants').insert(row)
    if (error) return { retired, error: `儲存規格「${v.variant_name}」失敗` }
  }
  return { retired }
}
