import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonLdHtml } from '../lib/jsonLd.ts'

test('商品名稱裡的 </script> 不能跳出 JSON-LD', () => {
  const html = jsonLdHtml({ name: '魚精</script><script>alert(1)</script>', note: 'A & B' })
  assert.ok(!html.includes('<') && !html.includes('>') && !html.includes('&'))
  assert.deepEqual(JSON.parse(html), { name: '魚精</script><script>alert(1)</script>', note: 'A & B' })   // 內容不變
})
