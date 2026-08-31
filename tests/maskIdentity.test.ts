import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  maskName, relativeTime, toPublicRecentOrder, isRecentEnough,
} from '../lib/presale/maskIdentity.ts'

describe('姓名遮罩', () => {
  test('三字姓名遮中間', () => {
    assert.equal(maskName('陳如玉'), '陳＊玉')
  })
  test('四字姓名遮中間兩字', () => {
    assert.equal(maskName('王小明豪'), '王＊＊豪')
  })
  test('兩字姓名只留姓', () => {
    assert.equal(maskName('李明'), '李＊')
  })
  test('單字也不完整露出', () => {
    assert.equal(maskName('陳'), '陳＊')
  })
  test('空值不會變成空字串', () => {
    assert.equal(maskName(''), '匿名')
    assert.equal(maskName(null), '匿名')
    assert.equal(maskName(undefined), '匿名')
    assert.equal(maskName('   '), '匿名')
  })
  test('英文名字同樣規則', () => {
    assert.equal(maskName('Chen'), 'C＊＊n')
  })
  test('遮罩後一定看不到完整原字串', () => {
    for (const n of ['陳如玉', '王小明豪', '李明', 'Chen']) {
      assert.notEqual(maskName(n), n)
    }
  })
})

describe('相對時間（刻意不給精確時間戳）', () => {
  const now = new Date('2026-09-01T12:00:00Z')
  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString()

  test('五分鐘內顯示剛剛', () => {
    assert.equal(relativeTime(ago(0), now), '剛剛')
    assert.equal(relativeTime(ago(4), now), '剛剛')
  })
  test('一小時內顯示分鐘', () => {
    assert.equal(relativeTime(ago(30), now), '30 分鐘前')
  })
  test('一天內顯示小時', () => {
    assert.equal(relativeTime(ago(60 * 5), now), '5 小時前')
  })
  test('跨天顯示天數', () => {
    assert.equal(relativeTime(ago(60 * 24), now), '昨天')
    assert.equal(relativeTime(ago(60 * 24 * 3), now), '3 天前')
  })
  test('超過一週統一顯示，不再精確', () => {
    assert.equal(relativeTime(ago(60 * 24 * 20), now), '一週前')
  })
  test('未來時間不會變成負數', () => {
    assert.equal(relativeTime(new Date(now.getTime() + 60000).toISOString(), now), '剛剛')
  })
  test('壞掉的時間回空字串，不會顯示 NaN', () => {
    assert.equal(relativeTime('not-a-date', now), '')
  })
})

describe('太舊的不顯示', () => {
  const now = new Date('2026-09-01T12:00:00Z')
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString()

  test('兩週內算近期', () => {
    assert.equal(isRecentEnough(daysAgo(1), now), true)
    assert.equal(isRecentEnough(daysAgo(13), now), true)
  })
  test('超過兩週不算', () => {
    assert.equal(isRecentEnough(daysAgo(15), now), false)
    assert.equal(isRecentEnough(daysAgo(60), now), false)
  })
  test('壞掉的時間不算', () => {
    assert.equal(isRecentEnough('x', now), false)
  })
})

describe('對外輸出只有兩個欄位', () => {
  const now = new Date('2026-09-01T12:00:00Z')

  test('欄位固定，不夾帶其他資料', () => {
    const out = toPublicRecentOrder({
      customer_name: '陳如玉',
      created_at: new Date(now.getTime() - 600000).toISOString(),
    }, now)
    assert.deepEqual(Object.keys(out).sort(), ['name', 'when'])
    assert.equal(out.name, '陳＊玉')
    assert.equal(out.when, '10 分鐘前')
  })

  test('輸出裡沒有原始姓名，也完全沒有電話欄位', () => {
    const out: any = toPublicRecentOrder({
      // 就算呼叫端硬塞 phone 進來，也不會出現在輸出裡
      customer_name: '陳如玉', phone: '0931234698', created_at: now.toISOString(),
    } as any, now)
    const json = JSON.stringify(out)
    assert.equal(json.includes('陳如玉'), false)
    assert.equal(json.includes('0931'), false)
    assert.equal('phone' in out, false)
  })

  test('缺資料時也不會壞掉', () => {
    const out = toPublicRecentOrder(
      { customer_name: null, created_at: now.toISOString() }, now)
    assert.equal(out.name, '匿名')
  })
})
