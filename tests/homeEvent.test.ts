import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { pickOpenEvent, type HomeEventRow } from '../lib/homeEvent.ts'
import { EVENT_CLOSE_BEFORE_MS } from '../lib/utils.ts'

const NOW = new Date('2026-09-15T10:00:00+08:00')

function ev(over: Partial<HomeEventRow> = {}): HomeEventRow {
  return {
    slug: 'meetup', title: '88自醫社群・線下健康見面會',
    event_time: '9/20（六）14:00', is_active: true,
    starts_at: '2026-09-20T14:00:00+08:00',
    ...over,
  }
}

describe('首頁線下活動入口', () => {
  test('有開放報名的場次才回傳', () => {
    const picked = pickOpenEvent([ev()], NOW)
    assert.equal(picked?.slug, 'meetup')
    assert.equal(picked?.title, '88自醫社群・線下健康見面會')
    assert.equal(picked?.event_time, '9/20（六）14:00')
  })

  test('完全沒有活動時回 null —— 首頁不該掛著假的「開放報名」', () => {
    assert.equal(pickOpenEvent([], NOW), null)
    assert.equal(pickOpenEvent(null, NOW), null)
    assert.equal(pickOpenEvent(undefined, NOW), null)
  })

  test('未啟用的活動不算', () => {
    assert.equal(pickOpenEvent([ev({ is_active: false })], NOW), null)
  })

  test('報名已截止的不算（開始前 2 小時關閉）', () => {
    // 剛好在關閉線之前一分鐘 → 還開放
    const justOpen = new Date(new Date('2026-09-20T14:00:00+08:00').getTime() - EVENT_CLOSE_BEFORE_MS - 60_000)
    assert.ok(pickOpenEvent([ev()], justOpen))
    // 剛好在關閉線 → 已截止
    const justClosed = new Date(new Date('2026-09-20T14:00:00+08:00').getTime() - EVENT_CLOSE_BEFORE_MS)
    assert.equal(pickOpenEvent([ev()], justClosed), null)
  })

  test('活動已經過去 → 不顯示', () => {
    assert.equal(pickOpenEvent([ev({ starts_at: '2026-09-01T14:00:00+08:00' })], NOW), null)
  })

  test('多場開放時取最快開始的那一場', () => {
    const picked = pickOpenEvent([
      ev({ slug: 'late', starts_at: '2026-10-30T14:00:00+08:00' }),
      ev({ slug: 'soon', starts_at: '2026-09-18T14:00:00+08:00' }),
      ev({ slug: 'mid', starts_at: '2026-10-01T14:00:00+08:00' }),
    ], NOW)
    assert.equal(picked?.slug, 'soon')
  })

  test('沒有開始時間的活動排最後，不會蓋過快開始的新活動', () => {
    // starts_at 是後來才加的欄位，舊資料可能是空的
    const picked = pickOpenEvent([
      ev({ slug: 'legacy', starts_at: null }),
      ev({ slug: 'soon', starts_at: '2026-09-18T14:00:00+08:00' }),
    ], NOW)
    assert.equal(picked?.slug, 'soon')
  })

  test('只有沒日期的舊活動時仍然顯示（不自動關閉）', () => {
    const picked = pickOpenEvent([ev({ slug: 'legacy', starts_at: null })], NOW)
    assert.equal(picked?.slug, 'legacy')
  })

  test('沒有 slug 的資料不會產生壞掉的連結', () => {
    assert.equal(pickOpenEvent([ev({ slug: '' })], NOW), null)
  })

  test('回傳值只有畫面要用的三個欄位', () => {
    const picked = pickOpenEvent([ev()], NOW)
    assert.deepEqual(Object.keys(picked || {}).sort(), ['event_time', 'slug', 'title'])
  })

  test('沒有活動時間時也能顯示（畫面會自己隱藏那一行）', () => {
    const picked = pickOpenEvent([ev({ event_time: null })], NOW)
    assert.equal(picked?.event_time, null)
  })
})
