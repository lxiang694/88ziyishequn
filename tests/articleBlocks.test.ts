import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseArticle, joinWrapped } from '../lib/articleBlocks.ts'

const types = (c: string) => parseArticle(c).map(b => b.type)
const texts = (c: string) =>
  parseArticle(c).map(b => ('text' in b ? b.text : 'items' in b ? b.items.join('|') : b.type))

describe('折行接合：中文之間不補空格', () => {
  test('中文接中文不加空格', () => {
    assert.equal(joinWrapped(['每天補充足夠的', '水分很重要']), '每天補充足夠的水分很重要')
  })
  test('英數之間才加空格', () => {
    assert.equal(joinWrapped(['vitamin', 'D3']), 'vitamin D3')
  })
  test('中英交界不加空格（避免憑空多出空隙）', () => {
    assert.equal(joinWrapped(['補充', 'D3']), '補充D3')
    assert.equal(joinWrapped(['D3', '很重要']), 'D3很重要')
  })
  test('單行原樣回傳', () => {
    assert.equal(joinWrapped(['只有一行']), '只有一行')
  })
})

describe('沒有空行的文章（作者按一次 Enter 分段）', () => {
  const content = [
    '睡眠不足會影響免疫力。',
    '每天最好睡滿七小時。',
    '如果長期睡不好，建議先諮詢醫師。',
  ].join('\n')

  test('每一句都是獨立段落，不會黏成一大塊', () => {
    assert.deepEqual(types(content), ['p', 'p', 'p'])
  })

  test('段落內容正確，沒有多餘空格', () => {
    assert.deepEqual(texts(content), [
      '睡眠不足會影響免疫力。',
      '每天最好睡滿七小時。',
      '如果長期睡不好，建議先諮詢醫師。',
    ])
  })

  test('沒有標點結尾的長句會被視為折行接起來', () => {
    const wrapped = [
      '這是一段很長的說明文字用來測試折行處理它本身沒有標點結尾所以',
      '應該要跟下一行接在一起變成同一段。',
    ].join('\n')
    const b = parseArticle(wrapped)
    assert.equal(b.length, 1)
    assert.equal(b[0].type, 'p')
  })
})

describe('有空行的文章走標準 Markdown 慣例', () => {
  const content = [
    '第一段的開頭',
    '這是折行的後半。',
    '',
    '第二段。',
  ].join('\n')

  test('空行才換段；同段內的折行接起來', () => {
    const b = parseArticle(content)
    assert.deepEqual(b.map(x => x.type), ['p', 'p'])
    assert.equal((b[0] as any).text, '第一段的開頭這是折行的後半。')
  })
})

describe('標題', () => {
  test('# 與 ## 都當 h2；### 是 h3；#### 是 h4', () => {
    assert.deepEqual(types('# 大標\n\n## 次標\n\n### 小標\n\n#### 更小'),
      ['h2', 'h2', 'h3', 'h4'])
  })

  test('整行粗體視為標題', () => {
    const b = parseArticle('**為什麼要補充葉黃素**\n\n因為現代人用眼過度。')
    assert.equal(b[0].type, 'h3')
    assert.equal((b[0] as any).text, '為什麼要補充葉黃素')
  })

  test('整行粗體但有句號結尾 → 是內文不是標題', () => {
    const b = parseArticle('**請務必先諮詢醫師。**')
    assert.equal(b[0].type, 'p')
  })

  test('整行粗體但很長 → 是內文不是標題', () => {
    const b = parseArticle(`**${'長'.repeat(50)}**`)
    assert.equal(b[0].type, 'p')
  })

  test('中文章節序號視為標題', () => {
    assert.equal(parseArticle('一、什麼是葉黃素')[0].type, 'h2')
    assert.equal(parseArticle('（一）攝取來源')[0].type, 'h2')
  })

  test('句子開頭剛好是「一、」但整句很長 → 不是標題', () => {
    const long = '一、' + '這是一段很長的說明'.repeat(6)
    assert.equal(parseArticle(long)[0].type, 'p')
  })
})

describe('條列', () => {
  test('各種符號都認得', () => {
    for (const mark of ['-', '*', '+', '•', '‧', '·', '※']) {
      const b = parseArticle(`${mark} 第一項\n${mark} 第二項`)
      assert.equal(b.length, 1, `${mark} 應該產生一個清單`)
      assert.equal(b[0].type, 'ul')
      assert.deepEqual((b[0] as any).items, ['第一項', '第二項'])
    }
  })

  test('編號條列：1. / 1) / (1) / ①', () => {
    for (const c of ['1. 甲\n2. 乙', '1) 甲\n2) 乙', '(1) 甲\n(2) 乙', '① 甲\n② 乙']) {
      const b = parseArticle(c)
      assert.equal(b[0].type, 'ol', `${c} 應該是編號清單`)
      assert.deepEqual((b[0] as any).items, ['甲', '乙'])
    }
  })

  test('符號清單與編號清單不會混在一起', () => {
    assert.deepEqual(types('- 甲\n1. 乙'), ['ul', 'ol'])
  })

  test('清單接在內文後面會正確斷開', () => {
    assert.deepEqual(types('注意事項如下：\n- 甲\n- 乙'), ['p', 'ul'])
  })
})

describe('其他區塊', () => {
  test('引用', () => {
    const b = parseArticle('> 請先諮詢醫師')
    assert.equal(b[0].type, 'quote')
    assert.equal((b[0] as any).text, '請先諮詢醫師')
  })

  test('圖片', () => {
    const b = parseArticle('![示意圖](https://example.com/a.jpg)')
    assert.equal(b[0].type, 'image')
    assert.equal((b[0] as any).src, 'https://example.com/a.jpg')
    assert.equal((b[0] as any).alt, '示意圖')
  })

  test('分隔線', () => {
    assert.deepEqual(types('上面\n\n---\n\n下面'), ['p', 'hr', 'p'])
  })
})

describe('實際貼上來的內容', () => {
  test('Word／AI 常見格式：標題 + 無空行段落 + 編號清單', () => {
    const content = [
      '## 睡不好怎麼辦',
      '現代人壓力大，睡眠品質普遍不佳。',
      '長期下來會影響免疫力與情緒。',
      '建議可以從以下幾點著手：',
      '1. 固定作息時間',
      '2. 睡前避免使用手機',
      '3. 適度運動',
      '如果調整後仍然睡不好，請諮詢醫師。',
    ].join('\n')

    assert.deepEqual(types(content), ['h2', 'p', 'p', 'p', 'ol', 'p'])
    const b = parseArticle(content)
    assert.deepEqual((b[4] as any).items, ['固定作息時間', '睡前避免使用手機', '適度運動'])
  })

  test('Windows 換行（\\r\\n）也能正確處理', () => {
    assert.deepEqual(types('第一段。\r\n第二段。'), ['p', 'p'])
  })

  test('全形空白不會讓段落被誤判為空行', () => {
    const b = parseArticle('　　開頭有全形縮排的一段。')
    assert.equal(b.length, 1)
    assert.equal(b[0].type, 'p')
  })

  test('空內容不會爆掉', () => {
    assert.deepEqual(parseArticle(''), [])
    assert.deepEqual(parseArticle(null), [])
    assert.deepEqual(parseArticle(undefined), [])
    assert.deepEqual(parseArticle('\n\n\n'), [])
  })

  test('連續多個空行只算一次斷段', () => {
    assert.deepEqual(types('甲。\n\n\n\n乙。'), ['p', 'p'])
  })
})
