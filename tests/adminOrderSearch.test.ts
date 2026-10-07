import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeOrderSearch, shouldApplyDateFilter, isDateFilterOverridden,
  productKeywordTerms, productKeywordFilters, MAX_PRODUCT_TERMS,
} from '../lib/adminOrderSearch.ts'

describe('搜尋字串整理', () => {
  test('正常輸入原樣保留', () => {
    assert.equal(sanitizeOrderSearch('TW20260825960167'), 'TW20260825960167')
    assert.equal(sanitizeOrderSearch('陳如玉'), '陳如玉')
    assert.equal(sanitizeOrderSearch('0931234698'), '0931234698')
  })

  test('逗號會破壞 PostgREST 的 or() 結構，換成空白', () => {
    assert.equal(sanitizeOrderSearch('王,陳'), '王 陳')
  })

  test('括號同樣會破壞結構', () => {
    assert.equal(sanitizeOrderSearch('陳(如玉)'), '陳 如玉')
  })

  test('雙引號在 PostgREST 裡是值的引號，同樣換成空白', () => {
    assert.equal(sanitizeOrderSearch('紫蘇油"3瓶'), '紫蘇油 3瓶')
  })

  test('LIKE 萬用字元被移除 —— 否則輸入一個 % 就撈出全部訂單', () => {
    assert.equal(sanitizeOrderSearch('%'), '')
    assert.equal(sanitizeOrderSearch('_'), '')
    assert.equal(sanitizeOrderSearch('TW%2026'), 'TW2026')
    assert.equal(sanitizeOrderSearch('a_b'), 'ab')
  })

  test('反斜線（LIKE 的跳脫字元）被移除', () => {
    assert.equal(sanitizeOrderSearch('a\\b'), 'ab')
  })

  test('前後空白與連續空白收斂', () => {
    assert.equal(sanitizeOrderSearch('  陳   如玉  '), '陳 如玉')
  })

  test('空值一律回空字串', () => {
    assert.equal(sanitizeOrderSearch(''), '')
    assert.equal(sanitizeOrderSearch('   '), '')
    assert.equal(sanitizeOrderSearch(null), '')
    assert.equal(sanitizeOrderSearch(undefined), '')
  })

  test('限長 50，避免超長字串塞進查詢', () => {
    assert.equal(sanitizeOrderSearch('a'.repeat(200)).length, 50)
  })

  test('整理後不含任何結構或萬用字元', () => {
    for (const raw of ['a,b(c)%d_e\\f', '%%%', 'TW,2026(08)%']) {
      const out = sanitizeOrderSearch(raw)
      for (const bad of [',', '(', ')', '"', '%', '_', '\\']) {
        assert.equal(out.includes(bad), false, `${raw} → ${out} 仍含有 ${bad}`)
      }
    }
  })
})

describe('搜尋時忽略期間篩選', () => {
  test('沒有搜尋時，期間篩選照常套用', () => {
    assert.equal(shouldApplyDateFilter('', 'month'), true)
    assert.equal(shouldApplyDateFilter('', 'today'), true)
  })

  test('有搜尋時，一律不套用期間篩選', () => {
    assert.equal(shouldApplyDateFilter('TW2026', 'month'), false)
    assert.equal(shouldApplyDateFilter('陳如玉', 'today'), false)
    assert.equal(shouldApplyDateFilter('0931', 'custom'), false)
  })

  test('兩者都沒有時也不加日期條件（顯示全部）', () => {
    assert.equal(shouldApplyDateFilter('', ''), false)
  })

  test('只有在兩者同時存在時才算「被覆蓋」，要提示使用者', () => {
    assert.equal(isDateFilterOverridden('TW2026', 'month'), true)
    assert.equal(isDateFilterOverridden('TW2026', ''), false)
    assert.equal(isDateFilterOverridden('', 'month'), false)
    assert.equal(isDateFilterOverridden('', ''), false)
  })
})

describe('實際踩到的情境', () => {
  test('從儀表板「本月訂單」進來後搜尋上個月的訂單編號，找得到', () => {
    // 儀表板連結是 /admin/orders?dateRange=month
    const dateRange = 'month'
    const search = sanitizeOrderSearch('TW20260715123456')
    assert.equal(shouldApplyDateFilter(search, dateRange), false)
    assert.equal(isDateFilterOverridden(search, dateRange), true)
  })
})

describe('商品關鍵字篩選', () => {
  test('用空白拆成詞，重複的詞只留一個', () => {
    assert.deepEqual(productKeywordTerms('紫蘇油 3瓶'), ['紫蘇油', '3瓶'])
    assert.deepEqual(productKeywordTerms('  紫蘇油   紫蘇油 '), ['紫蘇油'])
  })

  test('空值、只有萬用字元時不篩選', () => {
    for (const raw of [null, undefined, '', '   ', '%', '_%_']) assert.deepEqual(productKeywordTerms(raw), [])
  })

  test(`最多 ${MAX_PRODUCT_TERMS} 個詞`, () => {
    assert.equal(productKeywordTerms('a b c d e').length, MAX_PRODUCT_TERMS)
  })

  test('每個詞比對商品名稱、規格、貨號三個欄位', () => {
    assert.deepEqual(productKeywordFilters(['紫蘇油']), [
      'product_name_snapshot.ilike.%紫蘇油%,variant_name_snapshot.ilike.%紫蘇油%,sku_snapshot.ilike.%紫蘇油%',
    ])
  })

  test('幾個詞就幾組條件（組與組之間是 AND）', () => {
    assert.equal(productKeywordFilters(productKeywordTerms('紫蘇油 3瓶')).length, 2)
    assert.deepEqual(productKeywordFilters([]), [])
  })

  test('輸入的符號不會破壞 or() 結構', () => {
    for (const filter of productKeywordFilters(productKeywordTerms('紫蘇,油(3瓶)" %'))) {
      // 每組固定三個條件：多出來的逗號或括號都代表使用者輸入跑進了語法裡
      assert.equal(filter.split(',').length, 3, filter)
      assert.equal(/[()"]/.test(filter), false, filter)
    }
  })
})
