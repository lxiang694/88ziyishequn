import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectSectionHeading, splitSections, legacyToDescription, sectionsToLegacy, specRows, featureTitles } from '../lib/productSections.ts'

const paste = `每錠含 500mg，素食膠囊，美國原裝。

【商品重點】
每錠 500mg・素食膠囊・每日 1 錠

產品特色
01｜每錠 500mg
一天一錠就夠。
02｜素食膠囊
吃素的朋友也能食用。

適合誰：
常熬夜、作息不規律
三餐外食、蔬果吃得少
工作忙碌、生活壓力大

1. 使用方法
每日 1 錠，飯後以溫水食用。

搭配建議
可搭配維生素 C 一起補充。

成分規格
每錠含量：NAC 500mg。其他成分：植物纖維素膠囊。數量：100 顆。

⚠️ 注意事項
孕婦、哺乳期、服藥中請先諮詢醫師。

保存方式
置於陰涼乾燥處。`

test('各種小標寫法都認得，內文的句子不會被當成標題', () => {
  for (const [line, kind] of [['適合誰', 'who'], ['適合誰：', 'who'], ['【適合誰】', 'who'], ['■ 使用方法', 'usage'], ['1. 使用方法', 'usage'], ['一、注意事項', 'caution'], ['## 成分規格', 'spec'], ['✅產品特色', 'features'], ['使用注意事項', 'caution']] as const) {
    assert.equal(detectSectionHeading(line)?.kind, kind, line)
  }
  assert.equal(detectSectionHeading('每日 1 錠，飯後食用。'), null)
  assert.equal(detectSectionHeading('01｜每錠 500mg'), null)       // 特色卡的小標
  assert.equal(detectSectionHeading('常熬夜、作息不規律'), null)
  assert.equal(detectSectionHeading('3. 開封後請盡快食用完畢'), null)   // 只是剛好有「食用」
  assert.equal(detectSectionHeading('搭配建議')?.kind, 'pairing')
  assert.equal(detectSectionHeading('【限量優惠】')?.kind, 'other')  // 不認得但明顯是標題
})

test('整篇貼上 → 依小標分區（開場、重點、特色、適合誰、怎麼用、怎麼搭、規格、注意事項、保存）', () => {
  const s = splitSections(paste)
  assert.deepEqual(s.map(x => x.kind), ['intro', 'summary', 'features', 'who', 'usage', 'pairing', 'spec', 'caution', 'storage'])
  assert.equal(s[3].body, '常熬夜、作息不規律\n三餐外食、蔬果吃得少\n工作忙碌、生活壓力大')
  assert.deepEqual(featureTitles(s), ['每錠 500mg', '素食膠囊'])
})

test('規格：同一行用句號隔開的「標籤：值」也排成表格；不是這種寫法就不排', () => {
  assert.deepEqual(specRows('每錠含量：NAC 500mg。其他成分：植物纖維素膠囊。數量：100 顆。'), [
    { label: '每錠含量', value: 'NAC 500mg' }, { label: '其他成分', value: '植物纖維素膠囊' }, { label: '數量', value: '100 顆' }])
  assert.deepEqual(specRows('材質：艾絨、棉布\n尺寸：約 60 × 45 cm'), [{ label: '材質', value: '艾絨、棉布' }, { label: '尺寸', value: '約 60 × 45 cm' }])
  assert.equal(specRows('天然萃取，不含防腐劑。每瓶 100 顆。'), null)
})

test('整篇 ↔ 舊欄位：存回舊欄位內容不丟；舊商品組成一篇再切回來一樣', () => {
  const legacy = sectionsToLegacy(splitSections(paste))
  assert.match(legacy.suitable_people!, /商品重點[\s\S]*產品特色[\s\S]*適合誰/)
  assert.equal(legacy.usage_method, '每日 1 錠，飯後以溫水食用。')
  assert.equal(legacy.precautions, '孕婦、哺乳期、服藥中請先諮詢醫師。')
  const old = { suitable_people: '長時間用電腦的人', usage_method: '每天一次', ingredients: '材質：艾絨\n尺寸：60cm', storage_method: '陰涼處' }
  const text = legacyToDescription(old)
  assert.deepEqual(splitSections(text).map(x => x.kind), ['who', 'usage', 'spec', 'storage'])
  const back = sectionsToLegacy(splitSections(text))
  assert.equal(back.suitable_people, '長時間用電腦的人')     // 只有適合誰時不多包一層小標
  assert.equal(back.ingredients, old.ingredients)
})

test('以前把整篇文案放在「適合誰」的商品：不再多包一層「適合誰」', () => {
  const text = legacyToDescription({ suitable_people: '產品特色\n01｜螺旋紋玻璃濾杯\n說明。' })
  assert.equal(text.startsWith('產品特色'), true)
})

test('「標籤：說明」一行一項（紫蘇籽油的適合誰）→ 拆成標籤與說明；一般句子的清單也認得', async () => {
  const { labeledItems, lineItems } = await import('../lib/productSections.ts')
  const who = '不常吃魚、怕魚腥味的人：可從植物來源補充 Omega-3 ALA。\n\n素食／植物性飲食者：紫蘇籽油是很好的植物性 Omega-3 來源。\n\n35歲以上開始重視用油品質的人：適合用來調整日常脂肪酸攝取。'
  const items = labeledItems(who)!
  assert.equal(items.length, 3)
  assert.deepEqual(items[0], { label: '不常吃魚、怕魚腥味的人', desc: '可從植物來源補充 Omega-3 ALA。' })
  assert.equal(labeledItems('材質：艾絨\n很好用的一句話。'), null)          // 有一行不是這種寫法就不拆
  assert.deepEqual(lineItems('適合不常吃魚的人。\n適合吃素的朋友。'), ['適合不常吃魚的人', '適合吃素的朋友'])
  assert.equal(lineItems('這是一段很長很長的說明文字，超過四十個字的時候就不應該被當成清單裡面的一個項目，因為那其實是一整個段落。\n短句'), null)
})
