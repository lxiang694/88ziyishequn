import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recipientNameError, suggestRecipientName } from '../lib/recipientName.ts'
import { checkoutProblem } from '../lib/groupBuy/domain.ts'

test('取件人姓名規則', () => {
  for (const ok of ['王小明', '歐陽慧霞', '王明', 'Mary Lin', '鄭景耀']) assert.equal(recipientNameError(ok), null, ok)
  assert.equal(recipientNameError(''), '請填寫取件人姓名')
  assert.match(recipientNameError('鄭景耀,')!, /不能有數字、標點或符號/)
  assert.match(recipientNameError('王小明1')!, /不能有數字/)
  assert.match(recipientNameError('王')!, /至少要 2 個字/)
  assert.match(recipientNameError('六個中文姓名')!, /最多 5 個中文字/)
})

test('建議修正：去掉多打的符號', () => {
  assert.equal(suggestRecipientName('鄭景耀,'), '鄭景耀')
  assert.equal(suggestRecipientName(' 王小明。 '), '王小明')
  assert.equal(suggestRecipientName('王小明'), null, '本來就對，不用建議')
  assert.equal(suggestRecipientName('王1'), null, '修完只剩一個字，無法建議')
})

test('團購 7-11 取貨也要符合姓名規則；宅配不受限', () => {
  const base = { phone: '0912345678', items: [{ item_id: 1, quantity: 1 }] }
  assert.match(checkoutProblem({ ...base, customer_name: '鄭景耀,', shipping_method: '711', store_id: 3 }, ['711'])!, /標點/)
  assert.equal(checkoutProblem({ ...base, customer_name: '鄭景耀,', shipping_method: 'home', home_address: '台北市大安區建國南路一段28號', delivery_time: '不指定' }, ['home']), null)
})
