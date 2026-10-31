import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  campaignPhase, shippingFee, enabledMethods, generateGroupBuyOrderNo, twLocalToIso, isoToTwLocal,
  formatTwDateTime, addMonths, slugForStart, checkoutProblem, friendlyOrderError, supplierSummary, csvCell, csvDigits,
} from '../lib/groupBuy/domain.ts'

const camp = { is_published: true, starts_at: '2026-11-01T02:00:00Z', ends_at: '2026-11-10T15:59:00Z' }

describe('檔期階段', () => {
  test('草稿、預告、開團、截單', () => {
    assert.equal(campaignPhase({ ...camp, is_published: false }, new Date('2026-11-05T00:00:00Z')), 'draft')
    assert.equal(campaignPhase(camp, new Date('2026-10-31T00:00:00Z')), 'upcoming')
    assert.equal(campaignPhase(camp, new Date('2026-11-05T00:00:00Z')), 'open')
    assert.equal(campaignPhase(camp, new Date('2026-11-10T15:59:00Z')), 'closed')   // 截單那一刻就截單
  })
})

describe('運費與運送方式', () => {
  const c = { fee_711: 150, fee_home: 230, free_shipping_threshold: 3000 }
  test('各自的運費，滿額免運兩種都適用', () => {
    assert.equal(shippingFee(c, '711', 2999), 150)
    assert.equal(shippingFee(c, 'home', 2999), 230)
    assert.equal(shippingFee(c, 'home', 3000), 0)
    assert.equal(shippingFee({ ...c, free_shipping_threshold: null }, '711', 99999), 150)
  })
  test('7-11 常溫有自己的運費，也適用滿額免運；也要選門市', () => {
    const c2 = { fee_711: 150, fee_711_normal: 60, fee_home: 230, free_shipping_threshold: 3000 }
    assert.equal(shippingFee(c2, '711_normal', 100), 60)
    assert.equal(shippingFee(c2, '711_normal', 3000), 0)
    assert.match(checkoutProblem({ customer_name: '王', phone: '0912345678', shipping_method: '711_normal', items: [{ item_id: 1, quantity: 1 }] }, ['711_normal'])!, /門市/)
    assert.deepEqual(enabledMethods({ ship_711_enabled: false, ship_711_normal_enabled: true, ship_home_enabled: true }), ['711_normal', 'home'])
  })
  test('後台可以只開一種', () => {
    assert.deepEqual(enabledMethods({ ship_711_enabled: true, ship_home_enabled: false }), ['711'])
    assert.deepEqual(enabledMethods({ ship_711_enabled: true, ship_home_enabled: true }), ['711', 'home'])
  })
})

describe('單號與時間', () => {
  test('單號格式符合資料庫限制，日期用台灣時間', () => {
    const no = generateGroupBuyOrderNo(new Date('2026-11-01T17:00:00Z'), 0.000123)
    assert.equal(no, 'GB20261102000123')
    assert.match(generateGroupBuyOrderNo(), /^GB\d{14}$/)
  })
  test('後台日期欄位視為台灣時間，來回轉換不變', () => {
    assert.equal(twLocalToIso('2026-11-01T10:00'), '2026-11-01T02:00:00.000Z')
    assert.equal(isoToTwLocal('2026-11-01T02:00:00.000Z'), '2026-11-01T10:00')
    assert.equal(twLocalToIso('2026/11/01 10:00'), null)
  })
  test('給客人看的日期帶星期', () => {
    assert.equal(formatTwDateTime('2026-11-10T15:59:00Z'), '11/10（二）23:59')
  })
  test('複製到下個月：時間不變；31 號遇到小月落在月底', () => {
    assert.equal(isoToTwLocal(addMonths(twLocalToIso('2026-11-01T10:00')!)), '2026-12-01T10:00')
    assert.equal(isoToTwLocal(addMonths(twLocalToIso('2027-01-31T23:59')!)), '2027-02-28T23:59')
    assert.equal(isoToTwLocal(addMonths(twLocalToIso('2026-12-15T09:00')!)), '2027-01-15T09:00')
  })
  test('網址代稱用開團月份，重複時加序號', () => {
    assert.equal(slugForStart('2026-11-01T02:00:00Z'), '2026-11')
    assert.equal(slugForStart('2026-10-31T17:00:00Z'), '2026-11')   // 台灣已經是 11/1
    assert.equal(slugForStart('2026-11-01T02:00:00Z', ['2026-11', '2026-11-2']), '2026-11-3')
  })
})

describe('結帳資料檢查', () => {
  const ok = { customer_name: '王小明', phone: '0912345678', shipping_method: '711' as const, store_id: 5, items: [{ item_id: 1, quantity: 2 }] }
  test('7-11 與宅配的必填', () => {
    assert.equal(checkoutProblem(ok, ['711']), null)
    assert.match(checkoutProblem({ ...ok, store_id: null }, ['711'])!, /門市/)
    assert.match(checkoutProblem({ ...ok, shipping_method: 'home' }, ['711'])!, /取貨方式/)
    assert.match(checkoutProblem({ ...ok, shipping_method: 'home', home_address: '台北市' }, ['711', 'home'])!, /完整的收件地址/)
    assert.equal(checkoutProblem({ ...ok, shipping_method: 'home', home_address: '台北市大安區建國南路一段28號', delivery_time: '13點前' }, ['home']), null)
    assert.match(checkoutProblem({ ...ok, shipping_method: 'home', home_address: '台北市大安區建國南路一段28號', delivery_time: '半夜' }, ['home'])!, /時段/)
  })
  test('姓名、手機、商品', () => {
    assert.match(checkoutProblem({ ...ok, customer_name: ' ' }, ['711'])!, /姓名/)
    assert.match(checkoutProblem({ ...ok, phone: '0223456789' }, ['711'])!, /手機/)
    assert.match(checkoutProblem({ ...ok, items: [] }, ['711'])!, /至少選一樣/)
    assert.match(checkoutProblem({ ...ok, items: [{ item_id: 1, quantity: 1 }, { item_id: 1, quantity: 1 }] }, ['711'])!, /重複/)
    assert.match(checkoutProblem({ ...ok, items: [{ item_id: 1, quantity: 1.5 }] }, ['711'])!, /數量/)
  })
  test('資料庫的提示原樣給客人，技術錯誤換成通用訊息', () => {
    assert.equal(friendlyOrderError('「鱸魚精」剩 2 件'), '「鱸魚精」剩 2 件')
    assert.equal(friendlyOrderError('團購已截單'), '團購已截單')
    assert.match(friendlyOrderError('duplicate key value violates unique constraint'), /稍後再試/)
  })
})

describe('叫貨匯總與匯出', () => {
  test('加總每個商品，排除已取消，分出 7-11／宅配', () => {
    const line = (item_id: number, quantity: number) => ({ item_id, name_snapshot: `商品${item_id}`, spec_snapshot: '', quantity, subtotal: quantity * 100 })
    const s = supplierSummary([
      { status: '待出貨', shipping_method: '711', total_amount: 300, items: [line(1, 2), line(2, 1)] },
      { status: '已出貨', shipping_method: 'home', total_amount: 500, items: [line(1, 5)] },
      { status: '已取消', shipping_method: '711', total_amount: 900, items: [line(1, 9)] },
    ])
    assert.equal(s.orderCount, 2); assert.equal(s.revenue, 800)
    assert.deepEqual(s.items.map(i => [i.item_id, i.quantity, i.byMethod['711'], i.byMethod.home]), [[1, 7, 2, 5], [2, 1, 1, 0]])
  })
  test('CSV：逗號與引號跳脫、公式開頭被中和、數字保留開頭的 0', () => {
    assert.equal(csvCell('a,b'), '"a,b"')
    assert.equal(csvCell('他說"好"'), '"他說""好"""')
    assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
    assert.equal(csvDigits('0912345678'), '"=""0912345678"""')
    assert.equal(csvDigits('=1+1'), "'=1+1")
  })
})

import { parseCampaignInput, parseItemsInput } from '../lib/groupBuy/adminInput.ts'

describe('後台檔期資料檢查', () => {
  const base = {
    title: '11 月團購', slug: '2026-11', starts_at_local: '2026-11-01T10:00', ends_at_local: '2026-11-10T23:59',
    ship_711_enabled: true, ship_home_enabled: false, fee_711: '150', fee_home: '', free_shipping_threshold: '',
  }
  test('正常資料：時間轉成 UTC、空白欄位變 null／0', () => {
    const { value, error } = parseCampaignInput(base)
    assert.equal(error, undefined)
    assert.equal(value!.starts_at, '2026-11-01T02:00:00.000Z')
    assert.deepEqual([value!.fee_711, value!.fee_home, value!.free_shipping_threshold, value!.is_published], [150, 0, null, false])
  })
  test('擋下常見錯誤', () => {
    assert.match(parseCampaignInput({ ...base, title: '' }).error!, /名稱/)
    assert.match(parseCampaignInput({ ...base, slug: '十一月' }).error!, /代稱/)
    assert.match(parseCampaignInput({ ...base, ends_at_local: '2026-10-01T10:00' }).error!, /晚於/)
    assert.match(parseCampaignInput({ ...base, ship_711_enabled: false }).error!, /至少要開一種/)
    assert.match(parseCampaignInput({ ...base, fee_711: '-1' }).error!, /運費/)
    assert.equal(parseCampaignInput({ ...base, cover_image_url: 'javascript:alert(1)' }).value!.cover_image_url, null)
  })
  test('首頁入口背景圖：有送才帶（資料庫還沒加欄位時後台不送），只收 http(s)', () => {
    assert.equal('banner_image_url' in parseCampaignInput(base).value!, false)
    assert.equal(parseCampaignInput({ ...base, banner_image_url: 'https://x.co/a.jpg' }).value!.banner_image_url, 'https://x.co/a.jpg')
    assert.equal(parseCampaignInput({ ...base, banner_image_url: '' }).value!.banner_image_url, null)
    assert.equal(parseCampaignInput({ ...base, banner_image_url: 'javascript:alert(1)' }).value!.banner_image_url, null)
  })
  test('只開 7-11 常溫也可以，常溫運費另外存', () => {
    const { value, error } = parseCampaignInput({ ...base, ship_711_enabled: false, ship_711_normal_enabled: true, fee_711_normal: '60' })
    assert.equal(error, undefined)
    assert.deepEqual([value!.ship_711_enabled, value!.ship_711_normal_enabled, value!.fee_711_normal], [false, true, 60])
    assert.equal(parseCampaignInput(base).value!.ship_711_normal_enabled, false)
    assert.match(parseCampaignInput({ ...base, ship_711_normal_enabled: true, fee_711_normal: '9999' }).error!, /運費/)
  })
  test('商品：價格必填、選填欄位留空為不限、排序照順序', () => {
    const { value } = parseItemsInput([
      { name: '鱸魚精', spec: '6入', price: '1280', original_price: '', per_person_limit: '', total_quota: '100' },
      { id: 7, name: '禮盒', price: 2400, is_active: false },
    ])
    assert.deepEqual(value!.map(i => [i.id, i.price, i.original_price, i.total_quota, i.sort_order, i.is_active]),
      [[null, 1280, null, 100, 0, true], [7, 2400, null, null, 1, false]])
    assert.match(parseItemsInput([{ name: '鱸魚精', price: '' }]).error!, /團購價/)
    assert.match(parseItemsInput([{ name: '', price: 100 }]).error!, /商品名稱/)
    assert.match(parseItemsInput([{ name: 'x', price: 100, per_person_limit: '0' }]).error!, /每人限購/)
  })
})
