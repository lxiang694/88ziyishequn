import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nameSegments } from '../lib/wordBreak.ts'

test('品名斷詞：單字併回前一個詞，字一個都不少', () => {
  for (const name of ['6合一綜合維生素', '晚安足浴包', '脂質體維生素 C', '布拉迪益生菌', '控糖益生菌', 'NAC', '']) {
    assert.equal(nameSegments(name).join(''), name)
  }
  assert.deepEqual(nameSegments('6合一綜合維生素'), ['6合一', '綜合', '維生素'])
  assert.ok(nameSegments('布拉迪益生菌').includes('益生菌'))
  assert.ok(nameSegments('晚安足浴包').every(s => s !== '包'))
})
