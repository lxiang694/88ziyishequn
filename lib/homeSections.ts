// 首頁賣場分區（社群團購 / 小莊優選 / 居家生活 / 中醫食療）
// 首頁分區預覽、吸頂分類導航、後台商品表單共用此定義；日後要增減分類只需改這裡。
export interface HomeSection {
  key: string
  label: string
  emoji: string
}

// 顯示順序即首頁分區的呈現順序（本週熱銷為跨分區，不在此列）
export const HOME_SECTIONS: HomeSection[] = [
  { key: 'community', label: '88自醫社群團購', emoji: '🛒' },
  { key: 'xiaozhuang', label: '小莊優選', emoji: '⭐' },
  { key: 'home_living', label: '居家生活', emoji: '🏠' },
  { key: 'tcm_food', label: '中醫食療', emoji: '🌿' },
]

export const HOME_SECTION_KEYS = HOME_SECTIONS.map(s => s.key)

// 取得商品所屬分區：優先用 home_section 欄位；未設定時退回以名稱是否含「小莊代購」判斷，其餘歸社群團購
export function productSection(p: { home_section?: string | null; product_name?: string | null }): string {
  if (p.home_section && HOME_SECTION_KEYS.includes(p.home_section)) return p.home_section
  if ((p.product_name || '').includes('小莊代購')) return 'xiaozhuang'
  return 'community'
}
