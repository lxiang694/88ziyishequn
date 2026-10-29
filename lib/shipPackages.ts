/**
 * 現貨／預購分包（純函式，前後台共用，可測試）。
 *
 * 訂單最後是轉到賣貨便出貨：商品規格配到哪個賣場，就從那個賣場寄
 * （小莊備用88＝現貨、88好康＝預購）。同一張訂單的商品分屬兩個賣場時，
 * 賣貨便會拆成兩張、各寄一個包裹、各自代收。客人先拿到現貨那包，
 * 付的錢比下單金額少，常以為寄錯 —— 所以下單前後都要講清楚。
 *
 * 分包的依據跟轉單拆單完全一樣（myship_variant_mappings），
 * 客人看到的包裹數就是實際寄出的包裹數。
 */
export type ShipKind = '現貨' | '預購'
export const SHIP_KINDS: ShipKind[] = ['現貨', '預購']
/** 大約幾個工作日到店 */
export const SHIP_DAYS: Record<ShipKind, number> = { 現貨: 3, 預購: 7 }

export const isShipKind = (v: unknown): v is ShipKind => v === '現貨' || v === '預購'

/** 每個規格屬於哪一包：group 是賣場的代號（不外露賣場代碼），kind 是現貨／預購 */
export interface ShipGroup { group: number; kind: ShipKind | null }
export type ShipGroups = Record<number, ShipGroup>

export interface ShipPackage<T> { kind: ShipKind | null; days: number | null; items: T[]; amount: number }

const KIND_ORDER = (k: ShipKind | null) => (k === '現貨' ? 0 : k === '預購' ? 1 : 2)

/**
 * 把訂單商品分成實際寄出的包裹。
 * 只有「全部商品都知道走哪個賣場、而且分到兩個以上賣場」才回傳包裹；
 * 其他情況（只有一包、有商品還沒配賣場）回 null，畫面維持原樣。
 * 現貨排前面（通常先到），同類依商品出現順序。
 */
export function splitPackages<T extends { variant_id?: number | null; subtotal: number }>(items: T[], groups: ShipGroups): ShipPackage<T>[] | null {
  if (items.length < 2) return null
  const byGroup = new Map<number, ShipPackage<T>>()
  for (const item of items) {
    const g = item.variant_id != null ? groups[item.variant_id] : undefined
    if (!g) return null
    const p = byGroup.get(g.group) || { kind: g.kind, days: g.kind ? SHIP_DAYS[g.kind] : null, items: [], amount: 0 }
    p.items.push(item)
    p.amount += Number(item.subtotal) || 0
    byGroup.set(g.group, p)
  }
  if (byGroup.size < 2) return null
  return [...byGroup.values()].sort((a, b) => KIND_ORDER(a.kind) - KIND_ORDER(b.kind))
}

/** 「包裹 1・現貨」這種標題 */
export function packageTitle(p: { kind: ShipKind | null }, index: number): string {
  return `包裹 ${index + 1}${p.kind ? `・${p.kind}` : ''}`
}

/** 「約 3 個工作日到店」；不知道是現貨或預購時回空字串 */
export function packageEta(p: { days: number | null }): string {
  return p.days ? `約 ${p.days} 個工作日到店` : ''
}

const money = (n: number) => `NT$${Math.round(n).toLocaleString('en-US')}`

/** 代客下單確認訊息裡的分包說明（貼回 LINE 用） */
export function packagesMessage(packages: ShipPackage<{ name: string; quantity: number }>[]): string[] {
  const kinds = packages.map(p => p.kind).filter(Boolean)
  const why = kinds.includes('現貨') && kinds.includes('預購') ? '現貨和預購分開寄，' : ''
  return [
    `📦 這筆訂單會分 ${packages.length} 個包裹寄出`,
    `${why}會分開到店、分開付款：`,
    '',
    ...packages.flatMap((p, i) => [
      `【${packageTitle(p, i)}】${packageEta(p) ? packageEta(p) + '，' : ''}取貨付 ${money(p.amount)}`,
      ...p.items.map(it => `・${it.name} ×${it.quantity}`),
      '',
    ]),
    '先到的包裹金額比較少是正常的，不是寄錯喔！',
  ]
}
