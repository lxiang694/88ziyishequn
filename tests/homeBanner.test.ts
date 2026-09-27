import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSafeLinkPath, canDisplay, bannerLink, checkAspect, checkResolution,
  BANNER_ASPECT, type HomeBanner,
} from '../lib/homeBanner.ts'

const ok: HomeBanner = {
  image_url: 'https://xxx.supabase.co/storage/v1/object/public/products/banner.jpg',
  alt_text: '四步驟完成購物：選商品、選規格、填資料、選 7-11 門市',
  link_path: null,
  is_active: true,
}

describe('首頁橫幅：要不要顯示', () => {
  test('齊全而且啟用才顯示', () => {
    assert.equal(canDisplay(ok), true)
  })

  test('沒啟用就不顯示 —— 首頁會用回四步驟區塊', () => {
    assert.equal(canDisplay({ ...ok, is_active: false }), false)
  })

  test('沒圖片就不顯示，不要留一塊空白', () => {
    assert.equal(canDisplay({ ...ok, image_url: null }), false)
    assert.equal(canDisplay({ ...ok, image_url: '   ' }), false)
  })

  test('沒有文字說明就不顯示', () => {
    // 這塊原本放的是「怎麼完成下單」這種實際資訊。換成圖片之後沒有
    // alt，用讀屏軟體的人與搜尋引擎就什麼都拿不到
    assert.equal(canDisplay({ ...ok, alt_text: '' }), false)
    assert.equal(canDisplay({ ...ok, alt_text: '  ' }), false)
  })

  test('null / undefined 不會爆', () => {
    assert.equal(canDisplay(null), false)
    assert.equal(canDisplay(undefined), false)
  })
})

describe('首頁橫幅：連結', () => {
  test('站內路徑可以', () => {
    for (const p of ['/shop', '/shop/tea', '/products/purple-perilla-oil', '/events/spring']) {
      assert.equal(isSafeLinkPath(p), true, p)
    }
  })

  test('外站網址一律擋掉', () => {
    for (const p of ['https://evil.com', 'http://x.tw/a', '//evil.com', 'javascript:alert(1)']) {
      assert.equal(isSafeLinkPath(p), false, p)
    }
  })

  test('協定相對網址（//）會跳到外站，必須擋', () => {
    // 看起來像站內路徑，瀏覽器卻會當成 https://evil.com
    assert.equal(isSafeLinkPath('//evil.com/promo'), false)
  })

  test('不可帶參數', () => {
    // query 會進到伺服器 log 與分析工具，深層頁面自己會再驗一次授權
    assert.equal(isSafeLinkPath('/shop?utm_source=line'), false)
    assert.equal(isSafeLinkPath('/shop#top'), false)
  })

  test('反斜線擋掉 —— 某些瀏覽器會把 /\\evil.com 當成外站', () => {
    assert.equal(isSafeLinkPath('/\\evil.com'), false)
  })

  test('非字串與過長的擋掉', () => {
    assert.equal(isSafeLinkPath(null), false)
    assert.equal(isSafeLinkPath(123), false)
    assert.equal(isSafeLinkPath('/' + 'a'.repeat(300)), false)
  })

  test('bannerLink：沒填或不安全就回 null，圖片單純不可點', () => {
    assert.equal(bannerLink({ ...ok, link_path: '/shop' }), '/shop')
    assert.equal(bannerLink({ ...ok, link_path: '  /shop/tea  ' }), '/shop/tea')
    assert.equal(bannerLink({ ...ok, link_path: null }), null)
    assert.equal(bannerLink({ ...ok, link_path: 'https://evil.com' }), null)
  })
})

describe('首頁橫幅：圖片比例檢查', () => {
  test('16:9 直接過', () => {
    assert.equal(checkAspect(1600, 900).ok, true)
    assert.equal(checkAspect(1920, 1080).ok, true)
    assert.equal(checkAspect(1280, 720).ok, true)
  })

  test('差一點點也算過（5% 內）', () => {
    assert.equal(checkAspect(1600, 920).ok, true)
  })

  test('太寬：會裁左右，要講清楚裁哪邊', () => {
    const r = checkAspect(2400, 900)
    assert.equal(r.ok, false)
    assert.match(r.message, /左右兩側/)
    assert.match(r.message, /2400×900/)
  })

  test('太高（例如直式或正方形）：會裁上下', () => {
    const r = checkAspect(1000, 1000)
    assert.equal(r.ok, false)
    assert.match(r.message, /上下/)
  })

  test('不合比例也不擋，只是提醒 —— 前台是 object-cover，不會破版', () => {
    // 訊息要告訴使用者怎麼避免踩雷，而不是只說「錯了」
    assert.match(checkAspect(1000, 1000).message, /放在中間/)
    assert.match(checkAspect(1000, 1000).message, /1600×900/)
  })

  test('尺寸讀不到時給明確訊息，不要當成通過', () => {
    for (const [w, h] of [[0, 900], [1600, 0], [-1, 5], [NaN, NaN]]) {
      assert.equal(checkAspect(w, h).ok, false, `${w}×${h}`)
    }
    assert.match(checkAspect(0, 0).message, /讀不到/)
  })

  test('BANNER_ASPECT 就是 16:9', () => {
    assert.ok(Math.abs(BANNER_ASPECT - 1.7778) < 0.001)
  })
})

describe('首頁橫幅：解析度提醒', () => {
  test('夠寬就不囉唆', () => {
    assert.equal(checkResolution(1600), '')
    assert.equal(checkResolution(1920), '')
  })

  test('有點小：提醒桌機會糊', () => {
    assert.match(checkResolution(1200), /有點糊/)
  })

  test('很小：講明會明顯糊', () => {
    assert.match(checkResolution(600), /明顯糊/)
  })
})
