import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  hasCarePermission, CARE_PERMISSION_KEYS, ALL_CARE_PERMISSIONS,
} from '../../lib/care/domain.ts'
import {
  FULFILMENT_PERMISSION_KEYS, SUPERVISORY_READ_PERMISSIONS, FINANCE_ONLY_PERMISSION,
} from '../../lib/care/fulfilment/domain.ts'

/**
 * 授權：能進 /admin 不代表能看陪診個案。
 * 這裡驗證的是唯一的權限判斷來源；Route Handler 只是呼叫它。
 */
describe('陪診業務權限', () => {
  test('超級管理員（all）通過所有檢查', () => {
    for (const p of ALL_CARE_PERMISSIONS) {
      assert.ok(hasCarePermission(['all'], p), `all 應可通過 ${p}`)
    }
    assert.ok(hasCarePermission(['all'], ALL_CARE_PERMISSIONS))
  })

  test('持有對應權限者通過', () => {
    assert.ok(hasCarePermission([CARE_PERMISSION_KEYS.intake], CARE_PERMISSION_KEYS.intake))
    assert.ok(hasCarePermission([CARE_PERMISSION_KEYS.view], ALL_CARE_PERMISSIONS))
  })

  test('有陪診檢視權，仍不能做初評管理動作', () => {
    const granted = [CARE_PERMISSION_KEYS.view]
    assert.equal(hasCarePermission(granted, CARE_PERMISSION_KEYS.intake), false)
    assert.equal(hasCarePermission(granted, CARE_PERMISSION_KEYS.quote), false)
    assert.equal(hasCarePermission(granted, CARE_PERMISSION_KEYS.case), false)
  })

  test('只有零售權限的管理員一律被拒', () => {
    const retailOnly = ['orders.view', 'orders.status', 'products.all', 'categories.all', 'events.view']
    for (const p of ALL_CARE_PERMISSIONS) {
      assert.equal(hasCarePermission(retailOnly, p), false, `零售權限不應通過 ${p}`)
    }
    assert.equal(hasCarePermission(retailOnly, ALL_CARE_PERMISSIONS), false)
  })

  test('財務角色不會因為是財務就拿到初評讀取權', () => {
    const finance = ['orders.view']
    assert.equal(hasCarePermission(finance, CARE_PERMISSION_KEYS.intake), false)
  })

  test('沒有權限、空陣列、null、undefined 一律拒絕', () => {
    assert.equal(hasCarePermission([], CARE_PERMISSION_KEYS.intake), false)
    assert.equal(hasCarePermission(null, CARE_PERMISSION_KEYS.intake), false)
    assert.equal(hasCarePermission(undefined, CARE_PERMISSION_KEYS.intake), false)
  })

  test('required 為空時拒絕（避免誤設成人人可過）', () => {
    assert.equal(hasCarePermission(['all'], []), false)
    assert.equal(hasCarePermission([CARE_PERMISSION_KEYS.view], []), false)
  })

  test('近似但不相同的權限字串不通過', () => {
    assert.equal(hasCarePermission(['care_intake'], CARE_PERMISSION_KEYS.intake), false)
    assert.equal(hasCarePermission(['care_intake.manage.x'], CARE_PERMISSION_KEYS.intake), false)
    assert.equal(hasCarePermission(['care.view'], CARE_PERMISSION_KEYS.view), false)
  })

  test('舊的陪診預約權限 care.view 不等於陪診營運權限', () => {
    // care.view 是既有「陪診預約」頁的權限，責任不同，不得互相沿用
    assert.equal(hasCarePermission(['care.view'], ALL_CARE_PERMISSIONS), false)
  })
})

/**
 * Sprint D §7.8：財務與督導的隔離是雙向的。
 *
 * 兩邊都在 Admin portal 裡，但責任不同：
 * 財務要看的是金額，督導要看的是服務內容。
 * 任一邊因為「反正都是管理員」而讀到對方的資料，都是隱私事故。
 */
describe('履約：財務與督導的雙向隔離', () => {
  const FINANCE = [FULFILMENT_PERMISSION_KEYS.settlement]
  const SUPERVISOR = [FULFILMENT_PERMISSION_KEYS.record]
  const SUMMARY_REVIEWER = [FULFILMENT_PERMISSION_KEYS.summary]
  const OPS_VIEW = [FULFILMENT_PERMISSION_KEYS.view]

  test('財務讀不到內部服務紀錄、小結與異常（督導類讀取）', () => {
    assert.equal(hasCarePermission(FINANCE, SUPERVISORY_READ_PERMISSIONS), false)
  })

  test('督導、小結審核者與一般營運讀得到督導類清單', () => {
    for (const p of [SUPERVISOR, SUMMARY_REVIEWER, OPS_VIEW]) {
      assert.ok(hasCarePermission(p, SUPERVISORY_READ_PERMISSIONS))
    }
  })

  test('督導讀不到結算金額', () => {
    assert.equal(hasCarePermission(SUPERVISOR, FINANCE_ONLY_PERMISSION), false)
    assert.equal(hasCarePermission(SUMMARY_REVIEWER, FINANCE_ONLY_PERMISSION), false)
  })

  test('一般營運（care_operations.view）讀不到結算金額', () => {
    assert.equal(hasCarePermission(OPS_VIEW, FINANCE_ONLY_PERMISSION), false)
  })

  test('督導類讀取清單本身不得含結算權限', () => {
    assert.equal(SUPERVISORY_READ_PERMISSIONS.includes(FINANCE_ONLY_PERMISSION), false)
  })

  test('超級管理員兩邊都通過', () => {
    assert.ok(hasCarePermission(['all'], SUPERVISORY_READ_PERMISSIONS))
    assert.ok(hasCarePermission(['all'], FINANCE_ONLY_PERMISSION))
  })
})
