import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLabelHandoff, validateLabelResults } from '../lib/myship/localLabelAssistant.ts'

const A = 'CM0000000000001'
const B = 'CM0000000000002'
const valid = { orderNo: A, status: 'uploaded', sha256: 'a'.repeat(64), tracking: '7M123', carrier: '7-11', progress: 100, verification: 'rows', warnings: [] }

test('handoff uses fragment and sends only CM, source and pairing', () => {
  const url = new URL(buildLabelHandoff({ key:'a'.repeat(43), requestId:'11111111-1111-4111-8111-111111111111', orderNos:[A,A], source:'https://healthec.vercel.app',upload:true }))
  assert.equal(url.search, '')
  const data = JSON.parse(decodeURIComponent(url.hash.slice(9)))
  assert.deepEqual(data.orders, [A]); assert.equal(data.source,'https://healthec.vercel.app')
  assert.throws(() => buildLabelHandoff({ key:'bad',requestId:'bad',orderNos:[A],source:'https://healthec.vercel.app',upload:true }))
})

test('success requires progress, hash and recognized cells', () => {
  assert.equal(validateLabelResults([valid],[A])[0].status,'uploaded')
  for (const change of [{progress:null},{sha256:''},{tracking:''},{carrier:''}]) {
    assert.throws(() => validateLabelResults([{...valid,...change}],[A]))
  }
})

test('wrong batch and duplicate callbacks cannot import other orders', () => {
  assert.throws(() => validateLabelResults([{...valid,orderNo:B}],[A]))
  assert.throws(() => validateLabelResults([valid,valid],[A]))
})

test('manual confirmation is recorded separately and unknown carrier keeps warning', () => {
  const manual = validateLabelResults([{...valid,verification:'manual',progress:null,tracking:'',carrier:''}],[A])[0]
  assert.equal(manual.verification,'manual'); assert.equal(manual.progress,null)
  const unknown = validateLabelResults([{...valid,tracking:A,carrier:'未知',warnings:[`${A} 需要人工確認`]}],[A])[0]
  assert.equal(unknown.warnings.length,1)
})

test('unresolved results stay unresolved and do not claim progress', () => {
  const result = validateLabelResults([{orderNo:A,status:'uncertain',sha256:'a'.repeat(64),progress:0}],[A])[0]
  assert.equal(result.status,'uncertain'); assert.equal(result.progress,null)
})
