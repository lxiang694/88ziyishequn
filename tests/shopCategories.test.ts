import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  SHOP_CATEGORIES, SHOP_CATEGORY_SLUGS, isShopCategorySlug, shopCategoryBySlug,
  suggestShopCategories, normalizeCategoryIds,
} from '../lib/shopCategories.ts'

describe('商品分類：清單本身', () => {
  test('九個分類，順序就是要顯示的順序', () => {
    assert.equal(SHOP_CATEGORIES.length, 9)
    assert.deepEqual(SHOP_CATEGORIES.map(c => c.name), [
      '營養支持', '養身茶飲', '健康零食', '個護敷貼', '足浴香囊',
      '養生膏方', '傳統滋補', '外用草本保養', '居家生活',
    ])
  })

  test('slug 不重複，而且是可以放進網址的樣子', () => {
    assert.equal(new Set(SHOP_CATEGORY_SLUGS).size, 9)
    for (const s of SHOP_CATEGORY_SLUGS) {
      assert.match(s, /^[a-z][a-z-]*[a-z]$/, `slug ${s} 不適合放進網址`)
    }
  })

  test('每個分類都有說明 —— 分類頁的 meta description 靠它', () => {
    for (const c of SHOP_CATEGORIES) {
      assert.ok(c.description.length >= 10, `${c.name} 缺說明`)
      assert.ok(c.emoji.length > 0, `${c.name} 缺圖示`)
      assert.ok(c.forms.length > 0, `${c.name} 缺形式詞`)
    }
  })

  test('關鍵字不用單字通用詞', () => {
    // 「油」會讓紫蘇油與精油互相搶；「鐵」會把鐵鍋當成補鐵的營養素
    for (const c of SHOP_CATEGORIES) {
      for (const k of [...c.forms, ...c.keywords]) {
        assert.ok(k.length >= 2, `${c.name} 的「${k}」只有一個字，會亂命中`)
      }
    }
  })

  test('isShopCategorySlug 擋掉不存在的', () => {
    assert.equal(isShopCategorySlug('tea'), true)
    assert.equal(isShopCategorySlug('bone-joint'), false)   // 那是健康訴求分類
    assert.equal(isShopCategorySlug(''), false)
    assert.equal(isShopCategorySlug(null), false)
    assert.equal(isShopCategorySlug(123), false)
  })

  test('shopCategoryBySlug', () => {
    assert.equal(shopCategoryBySlug('herbal-paste')?.name, '養生膏方')
    assert.equal(shopCategoryBySlug('nope'), undefined)
  })
})

describe('商品分類：依商品名稱自動建議', () => {
  const suggest = (name: string, intro = '') =>
    suggestShopCategories({ product_name: name, short_intro: intro }).map(s => s.slug)

  test('站上現有的商品都猜得出來', () => {
    // 這些是使用者實際在賣的品項
    assert.equal(suggest('20mg 葉黃素軟膠囊')[0], 'nutrition')
    assert.equal(suggest('冷壓初榨紫蘇籽油 250ml')[0], 'nutrition')
    assert.equal(suggest('野生茶籽油 500ml')[0], 'nutrition')
    assert.equal(suggest('沙棘籽油軟膠囊')[0], 'nutrition')
    assert.equal(suggest('無塗層手工鐵鍋 30cm')[0], 'home-living')
    assert.equal(suggest('紅光近紅外線照護燈')[0], 'home-living')
  })

  test('新分類的代表品項', () => {
    assert.equal(suggest('桂圓紅棗茶包 15入')[0], 'tea')
    assert.equal(suggest('綜合堅果隨手包')[0], 'snacks')
    assert.equal(suggest('艾草足浴包 10入')[0], 'foot-bath')
    assert.equal(suggest('古法秋梨膏 300g')[0], 'herbal-paste')
    assert.equal(suggest('四物燉包')[0], 'tonic')
    assert.equal(suggest('舒緩按摩油 100ml')[0], 'topical-herbal')
    assert.equal(suggest('穴位敷貼 6片')[0], 'patch-care')
  })

  test('猜不出來就回空，不要亂塞一個預設分類', () => {
    // 分錯類客人就找不到，寧可留白讓人自己選
    assert.deepEqual(suggest('限定禮盒'), [])
    assert.deepEqual(suggest(''), [])
    assert.deepEqual(suggestShopCategories({}), [])
  })

  test('命中越長的關鍵字排越前面', () => {
    // 「紫蘇籽油」(4字) 應該壓過只靠「錠」之類的短詞
    const s = suggestShopCategories({ product_name: '紫蘇籽油' })
    assert.equal(s[0].slug, 'nutrition')
    assert.ok(s[0].matched.includes('紫蘇籽油'))
  })

  test('會回傳命中的關鍵字，後台要顯示理由', () => {
    const s = suggestShopCategories({ product_name: '艾草足浴包' })
    assert.ok(s[0].matched.length > 0)
    assert.ok(s[0].matched.some(k => '艾草足浴包'.includes(k)))
  })

  test('一個商品可能同時屬於兩類，兩個都建議', () => {
    // 阿膠糕：既是膏方也是傳統滋補
    const s = suggest('即食阿膠糕 滋補禮盒')
    assert.ok(s.length >= 2, `只建議了 ${s.length} 個`)
    assert.ok(s.includes('herbal-paste') && s.includes('tonic'))
  })

  test('簡介與成分也會被看進去', () => {
    const s = suggestShopCategories({
      product_name: '晨間沖泡組',
      short_intro: '決明子與菊花的溫和茶飲',
    })
    assert.equal(s[0].slug, 'tea')
  })

  test('大小寫不影響英文關鍵字', () => {
    assert.equal(suggest('Omega-3 深海魚油')[0], 'nutrition')
    assert.equal(suggest('CoQ10 輔酶膠囊')[0], 'nutrition')
  })
})

describe('商品分類：整理送進來的 id', () => {
  test('去重、保留順序', () => {
    assert.deepEqual(normalizeCategoryIds([3, 1, 3, 2]), [3, 1, 2])
  })

  test('字串數字可以，其餘丟掉', () => {
    assert.deepEqual(normalizeCategoryIds(['2', 4, '第三個', null, 1.5, -1, 0]), [2, 4])
  })

  test('不是陣列就回空，不要爆', () => {
    for (const bad of [null, undefined, 'abc', 42, {}]) {
      assert.deepEqual(normalizeCategoryIds(bad), [])
    }
  })

  test('空陣列回空 —— 由呼叫端決定那算不算錯', () => {
    // 商品上架時沒選分類是錯的，但篩選時不帶分類是正常的
    assert.deepEqual(normalizeCategoryIds([]), [])
  })
})
