import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { CARE_SCENARIOS, isCareScenario } from '../../lib/careBrand.ts'
import { SERVICE_SCENARIOS } from '../../lib/care/domain.ts'

/**
 * 前台分流卡片的 value 會直接送進 POST /api/care/intake，
 * 兩邊一旦不同步，使用者送出就會拿到 400。
 */
describe('前台情境代碼與 API 白名單一致', () => {
  test('兩份清單完全相同', () => {
    assert.deepEqual(
      CARE_SCENARIOS.map(s => s.value).slice().sort(),
      SERVICE_SCENARIOS.slice().sort(),
    )
  })

  test('每個前台代碼都能通過 API 白名單', () => {
    for (const s of CARE_SCENARIOS) {
      assert.ok((SERVICE_SCENARIOS as readonly string[]).includes(s.value), `${s.value} 不在 API 白名單`)
    }
  })

  test('isCareScenario 拒絕網址帶進來的任意值', () => {
    assert.equal(isCareScenario('../../etc/passwd'), false)
    assert.equal(isCareScenario('converted_to_case'), false)
    assert.equal(isCareScenario(null), false)
    assert.equal(isCareScenario(''), false)
    assert.ok(isCareScenario('routine_visit'))
  })
})
