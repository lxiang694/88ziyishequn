import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankProductArticles, nameFragments, normalizeText, type ArticleLike,
} from '../lib/productArticleMatcher.ts'

function article(over: Partial<ArticleLike> = {}): ArticleLike {
  return {
    id: 1, slug: 'a', title: '標題', excerpt: null, cover_image_url: null,
    category_slug: 'cardiovascular', reading_minutes: 5, view_count: 0, ...over,
  }
}

/** 站上真實的兩篇紫蘇油文章 */
const ZISU_1 = article({
  id: 26, slug: 'zisuyoushihe', view_count: 146,
  title: '紫蘇油適合誰？不吃魚、怕魚腥、想補植物性Omega-3的人，可以先看懂這幾件事!',
})
const ZISU_2 = article({
  id: 23, slug: 'zisuyou11', view_count: 148,
  title: '紫蘇油：一瓶北緯50°的植物Omega-3，這樣吃對身體最好',
})
/** 真實的紫蘇籽油商品 */
const ZISU_PRODUCT = {
  product_name: '紫蘇籽油',
  product_category_relations: [
    { health_categories: { slug: 'cardiovascular' } },
    { health_categories: { slug: 'eye-care' } },
  ],
}

describe('商品頁的相關文章推薦', () => {
  test('「紫蘇籽油」對得上標題寫「紫蘇油」的文章', () => {
    // 這是整個功能的重點：兩者不是子字串關係，中間差一個「籽」
    assert.equal('紫蘇油適合誰'.includes('紫蘇籽油'), false, '前提：直接比對確實抓不到')

    const ranked = rankProductArticles([ZISU_1, ZISU_2], ZISU_PRODUCT)
    assert.equal(ranked.length, 2)
    assert.deepEqual(ranked.map(r => r.article.slug).sort(), ['zisuyou11', 'zisuyoushihe'])
  })

  test('不相關的文章不會被推薦 —— 寧可不顯示也不要亂推', () => {
    const knee = article({ id: 1, slug: 'bone-joint-degeneration', category_slug: 'bone-joint',
      title: '我 45 歲那年，膝蓋開始抗議：聊聊關節保養這件事', view_count: 41 })
    assert.deepEqual(rankProductArticles([knee], ZISU_PRODUCT), [])
  })

  test('標題命中排在摘要命中前面', () => {
    const inTitle = article({ id: 1, slug: 'title-hit', title: '紫蘇油怎麼吃', category_slug: null })
    const inExcerpt = article({ id: 2, slug: 'excerpt-hit', title: '好油挑選指南',
      excerpt: '紫蘇油是其中一種選擇', category_slug: null })
    const ranked = rankProductArticles([inExcerpt, inTitle], ZISU_PRODUCT)
    assert.equal(ranked[0].article.slug, 'title-hit')
  })

  test('同分類加分，但分類相同不足以單獨上榜', () => {
    // 只有分類相同、名稱完全沒關係 → 25 分，高於門檻，會以「同類主題」出現
    const sameCat = article({ id: 9, slug: 'three-highs', category_slug: 'cardiovascular',
      title: '我先生健檢紅字那年，我們家是怎麼把三高慢慢調回來的' })
    const ranked = rankProductArticles([sameCat], ZISU_PRODUCT)
    assert.equal(ranked.length, 1)
    assert.equal(ranked[0].reason, '同類主題')

    // 但名稱有命中的一定排在它前面
    const withName = rankProductArticles([sameCat, ZISU_1], ZISU_PRODUCT)
    assert.equal(withName[0].article.slug, 'zisuyoushihe')
  })

  test('命中越長的片段分數越高', () => {
    const short = article({ id: 1, slug: 'short', title: '紫蘇這種植物', category_slug: null })
    const long = article({ id: 2, slug: 'long', title: '紫蘇籽油的挑選', category_slug: null })
    const ranked = rankProductArticles([short, long], ZISU_PRODUCT)
    assert.equal(ranked[0].article.slug, 'long')
  })

  test('通用詞不會讓所有文章都沾上邊', () => {
    // 「綜合維生素」裡的「綜合」是通用詞，不該靠它配對
    const generic = article({ id: 1, slug: 'g', title: '綜合比較各家品牌', category_slug: null })
    const ranked = rankProductArticles([generic], { product_name: '綜合維生素' })
    assert.deepEqual(ranked, [])
  })

  test('最多回傳指定筆數', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      article({ id: i + 1, slug: `z${i}`, title: `紫蘇油專題 ${i}`, category_slug: null }))
    assert.equal(rankProductArticles(many, ZISU_PRODUCT).length, 3)
    assert.equal(rankProductArticles(many, ZISU_PRODUCT, 5).length, 5)
  })

  test('空輸入不會爆', () => {
    assert.deepEqual(rankProductArticles([], ZISU_PRODUCT), [])
    assert.deepEqual(rankProductArticles(null, ZISU_PRODUCT), [])
    assert.deepEqual(rankProductArticles([ZISU_1], null), [])
    assert.deepEqual(rankProductArticles([ZISU_1], { product_name: '' }), [])
    assert.deepEqual(rankProductArticles([ZISU_1], {}), [])
  })

  test('沒有分類的商品仍能靠名稱配對', () => {
    const ranked = rankProductArticles([ZISU_1], { product_name: '紫蘇籽油' })
    assert.equal(ranked.length, 1)
  })
})

describe('名稱片段切法', () => {
  test('代購前綴與符號不影響比對', () => {
    assert.equal(normalizeText('【小莊代購】紫蘇籽油 250ml'), '紫蘇籽油250ml')
  })

  test('切出 2 到 4 字的片段', () => {
    const frags = nameFragments('紫蘇籽油')
    assert.ok(frags.includes('紫蘇'))
    assert.ok(frags.includes('紫蘇籽'))
    assert.ok(frags.includes('紫蘇籽油'))
    assert.ok(frags.includes('蘇籽油'))
  })

  test('通用片段被排除', () => {
    assert.equal(nameFragments('有機綜合保健食品').includes('有機'), false)
    assert.equal(nameFragments('有機綜合保健食品').includes('綜合'), false)
    assert.equal(nameFragments('有機綜合保健食品').includes('保健'), false)
  })

  test('太短的名稱不會產生片段', () => {
    assert.deepEqual(nameFragments('油'), [])
  })
})
