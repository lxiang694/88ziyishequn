import { supabaseAdmin } from './supabase'
import { isShipKind, type ShipGroups } from './shipPackages'

/**
 * 查這些規格各走哪個賣貨便賣場、是現貨還是預購。
 * 賣場代碼不往外傳，換成 0、1、2… 的代號。
 *
 * migrations/myship_ship_kind.sql 還沒執行時沒有 ship_kind 欄位：
 * 仍然照賣場分包（包裹數是對的），只是不標現貨／預購。
 * 連配對表都沒有時回空物件，畫面維持原樣。
 */
export async function loadShipGroups(variantIds: number[]): Promise<ShipGroups> {
  const ids = [...new Set(variantIds.filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
  if (!ids.length) return {}

  let rows: { variant_id: number; marketplace_id: string; kind: unknown }[] = []
  const withKind = await supabaseAdmin.from('myship_variant_mappings')
    .select('variant_id, marketplace_id, myship_marketplaces(ship_kind)').in('variant_id', ids)
  if (!withKind.error) {
    rows = (withKind.data || []).map((r: any) => {
      const m = Array.isArray(r.myship_marketplaces) ? r.myship_marketplaces[0] : r.myship_marketplaces
      return { variant_id: r.variant_id, marketplace_id: r.marketplace_id, kind: m?.ship_kind }
    })
  } else {
    const plain = await supabaseAdmin.from('myship_variant_mappings').select('variant_id, marketplace_id').in('variant_id', ids)
    if (plain.error) return {}
    rows = (plain.data || []).map((r: any) => ({ variant_id: r.variant_id, marketplace_id: r.marketplace_id, kind: null }))
  }

  const groupOf = new Map<string, number>()
  const out: ShipGroups = {}
  for (const r of rows.sort((a, b) => a.variant_id - b.variant_id)) {
    if (!groupOf.has(r.marketplace_id)) groupOf.set(r.marketplace_id, groupOf.size)
    out[r.variant_id] = { group: groupOf.get(r.marketplace_id)!, kind: isShipKind(r.kind) ? r.kind : null }
  }
  return out
}
