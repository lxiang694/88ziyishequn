import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifySource, entryViews, summarizeSources, utmFromSearch, type ViewRow } from '../lib/trafficSource.ts'

const SITE = 'www.88ziyishequn.com'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const key = (r: Partial<ViewRow>) => classifySource({ visitor_id: 'v', path: '/', created_at: '', ...r }, SITE).key

test('依來源網址分類', () => {
  assert.equal(key({ referrer: 'https://www.google.com/' }), 'google')
  assert.equal(key({ referrer: 'https://www.google.com.tw/' }), 'google')
  assert.equal(key({ referrer: 'android-app://com.google.android.googlequicksearchbox/' }), 'google')
  assert.equal(key({ referrer: 'https://tw.search.yahoo.com/' }), 'yahoo')
  assert.equal(key({ referrer: 'https://www.bing.com/' }), 'search')
  assert.equal(key({ referrer: 'https://l.facebook.com/' }), 'facebook')
  assert.equal(key({ referrer: 'https://m.facebook.com/' }), 'facebook')
  assert.equal(key({ referrer: 'https://l.instagram.com/' }), 'instagram')
  assert.equal(key({ referrer: 'https://line.me/R/' }), 'line')
  assert.equal(key({ referrer: 'https://www.threads.net/' }), 'threads')
  assert.equal(key({ referrer: 'https://blog.example.com/post' }), 'other')
})

test('站內網址或沒有來源：直接造訪', () => {
  assert.equal(key({ referrer: 'https://www.88ziyishequn.com/products/a' }), 'direct')
  assert.equal(key({ referrer: 'https://88ziyishequn.com/' }), 'direct')
  assert.equal(key({ referrer: 'https://healthec.vercel.app/' }), 'direct')
  assert.equal(key({ referrer: '', user_agent: IPHONE }), 'direct')
})

test('App 內建瀏覽器：沒有來源網址也認得出 LINE、FB、IG', () => {
  assert.equal(key({ user_agent: `${IPHONE} Safari Line/14.17.0` }), 'line')
  assert.equal(key({ user_agent: `${IPHONE} [FBAN/FBIOS;FBAV/480.0]` }), 'facebook')
  assert.equal(key({ user_agent: `${IPHONE} Instagram 350.0.0 (iPhone15,3)` }), 'instagram')
})

test('utm 標記優先', () => {
  assert.equal(key({ utm_source: 'line', referrer: '' }), 'line')
  assert.equal(key({ utm_source: 'LINE_OA' }), 'line')
  assert.equal(key({ utm_source: 'fb', referrer: 'https://www.google.com/' }), 'facebook')
  const other = classifySource({ visitor_id: 'v', path: '/', created_at: '', utm_source: 'Newsletter' }, SITE)
  assert.deepEqual(other, { key: 'other', detail: 'newsletter' })
})

const at = (min: number) => new Date(Date.UTC(2026, 9, 22, 2, min)).toISOString()

test('同一次造訪只算進站那一頁', () => {
  const rows: ViewRow[] = [
    { visitor_id: 'a', path: '/', created_at: at(0), referrer: 'https://www.google.com/' },
    // 站內換頁：document.referrer 還是 Google，不能再算一次
    { visitor_id: 'a', path: '/products/x', created_at: at(2), referrer: 'https://www.google.com/' },
    { visitor_id: 'a', path: '/cart', created_at: at(5), referrer: 'https://www.88ziyishequn.com/products/x' },
    // 隔 40 分鐘再回來：新的一次
    { visitor_id: 'a', path: '/', created_at: at(45), referrer: '' },
    // 10 分鐘內又從 FB 點進來：換了來源，也算新的一次
    { visitor_id: 'a', path: '/group-buy', created_at: at(50), referrer: 'https://l.facebook.com/' },
  ]
  assert.deepEqual(entryViews(rows, SITE).map(r => r.path), ['/', '/', '/group-buy'])
})

test('來源統計：次數、訪客、占比、落地頁、utm 活動', () => {
  const rows: ViewRow[] = [
    { visitor_id: 'a', path: '/products/x', created_at: at(0), referrer: 'https://www.google.com/' },
    { visitor_id: 'a', path: '/cart', created_at: at(1), referrer: 'https://www.google.com/' },
    { visitor_id: 'b', path: '/group-buy/oct', created_at: at(2), utm_source: 'line', utm_medium: 'group', utm_campaign: '十月團' },
    { visitor_id: 'c', path: '/group-buy/oct', created_at: at(3), user_agent: 'x Line/14.0' },
    { visitor_id: 'd', path: '/', created_at: at(4), referrer: 'https://blog.example.com/a' },
  ]
  const s = summarizeSources(rows, SITE)
  assert.equal(s.total_visits, 4)
  assert.deepEqual(s.sources.map(x => [x.key, x.visits, x.visitors]), [['line', 2, 2], ['google', 1, 1], ['other', 1, 1]])
  assert.equal(s.sources[0].share, 0.5)
  assert.deepEqual(s.sources[0].landings, [{ path: '/group-buy/oct', visits: 2 }])
  assert.deepEqual(s.other_sites, [{ name: 'blog.example.com', visits: 1 }])
  assert.deepEqual(s.campaigns, [{ source: 'line', medium: 'group', campaign: '十月團', visits: 1 }])
})

test('前台取 utm', () => {
  assert.deepEqual(utmFromSearch('?utm_source=line&utm_medium=group&q=魚油'), { utm_source: 'line', utm_medium: 'group' })
  assert.deepEqual(utmFromSearch(''), {})
})

test('親友推薦連結（?ref=）算成親友推薦', () => {
  assert.deepEqual(utmFromSearch('?ref=k7m2qx'), { utm_source: 'referral', utm_medium: 'friend', utm_campaign: 'K7M2QX' })
  assert.equal(classifySource({ visitor_id: 'v', path: '/', created_at: '', utm_source: 'referral' }, SITE).key, 'referral')
})
