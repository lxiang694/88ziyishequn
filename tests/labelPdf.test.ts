import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { zlibSync } from 'fflate'
import {
  mulMatrix, gridCuts, cellIndex, pageLayout, scanDrawItems,
  parsePdf, splitLabelPdf, labelFileName, LabelPdfError,
  type DrawItem,
} from '../lib/myship/labelPdf.ts'

// ── 真實樣本的座標 ─────────────────────────────────────
// 取自使用者 2026/09/21 批次列印的那份 PDF（A4 排 2×2，印了 3 張）。
// 這些數字是整個拆檔邏輯的依據，寫死在這裡當迴歸基準。

const ANCHORS = [
  { x: 108.54, y: 540.54, no: 'CM2609214719432' },  // 左上
  { x: 354.65, y: 540.54, no: 'CM2609214719459' },  // 右上
  { x: 108.54, y: 183.38, no: 'CM2609214719479' },  // 左下
]
const PITCH_X = 246.11
const PITCH_Y = 357.16
/** 一張面單裡，各元素相對於「寄貨訂單編號」的位移 */
const OFFSETS: [number, number][] = [
  [-63.03, -48.77], [-63.03, 39.02], [-55.53, -48.77], [-18.01, 29.27],
  [0, 0], [16.13, 242.37], [47.35, 114.81], [123.8, 212.35],
  [-52.53, 97.55], [-3.75, 91.55], [23.26, 66.78], [26.26, 87.04],
]
/** 頁首列印時間、頁尾網址與頁碼 —— 不屬於任何一張面單 */
const FURNITURE: [number, number][] = [
  [26.45, 819.92], [297.08, 818.92], [337.98, 818.92],
  [26.45, 16.92], [98.79, 16.92], [174.66, 16.92], [557.41, 16.92],
]

function sampleItems(): DrawItem[] {
  const items: DrawItem[] = []
  let at = 0
  const push = (x: number, y: number, text: string) =>
    items.push({ kind: 'text', start: at, end: (at += 10), x, y, text })

  for (const [x, y] of FURNITURE) push(x, y, '頁首頁尾')
  for (const a of ANCHORS) {
    push(a.x, a.y, `${a.no}-0`)
    for (const [dx, dy] of OFFSETS) {
      if (dx === 0 && dy === 0) continue
      push(a.x + dx, a.y + dy, '面單內容')
    }
  }
  return items
}

describe('面單拆檔：矩陣', () => {
  test('先平移再縮放', () => {
    // PDF 的 cm 是「新矩陣 × 目前矩陣」，順序弄反座標就全歪了
    assert.deepEqual(mulMatrix([1, 0, 0, 1, 10, 20], [2, 0, 0, 2, 0, 0]), [2, 0, 0, 2, 20, 40])
  })

  test('賣貨便面單的翻轉矩陣：y 由上往下變成由下往上', () => {
    // 瀏覽器列印出來的 PDF 開頭固定是 .24 0 0 -.24 0 841.92 cm
    const base: [number, number, number, number, number, number] = [0.24, 0, 0, -0.24, 0, 841.92]
    const inner: [number, number, number, number, number, number] = [4.1666665, 0, 0, 4.1666665, 0, 0]
    const m = mulMatrix(inner, base)
    // 內層座標 (108.54, 540.54) 應該落在頁面的 540.54 pt 高處以下
    const y = m[3] * 301.38 + m[5]
    assert.ok(Math.abs(y - (841.92 - 301.38)) < 0.01, `得到 ${y}`)
  })
})

describe('面單拆檔：格線', () => {
  test('用真實座標算出來的欄界落在兩張面單之間', () => {
    const items = sampleItems()
    const cut = gridCuts(ANCHORS.map(a => a.x), items.map(i => i.x))
    assert.ok(cut, '應該算得出欄界')
    assert.ok(Math.abs(cut!.pitch - PITCH_X) < 0.01, `間距 ${cut!.pitch}`)
    // 左欄最右邊的元素 232.34、右欄最左邊的 291.62，界線必須在兩者之間
    assert.ok(cut!.cut > 232.34 && cut!.cut < 291.62, `欄界 ${cut!.cut} 切在面單裡`)
  })

  test('欄界不會被面單「內部」那塊比較寬的留白騙走', () => {
    // 這是實際踩到的坑：面單裡「交貨便服務代碼」右邊有 76pt 的空白，
    // 比面單之間的 59pt 間隙還寬。用「最大空隙」當界線會切進面單裡，
    // 右緣的字元就被分到隔壁那張單 —— 表面上看不出來，面單卻是錯的。
    const items = sampleItems()
    const cut = gridCuts(ANCHORS.map(a => a.x), items.map(i => i.x))!
    const insideGap = 108.54 + 47.35 + (123.8 - 47.35) / 2   // 面單內部留白的中點
    assert.ok(Math.abs(cut.cut - insideGap) > 30, `欄界 ${cut.cut} 落在面單內部的留白`)
  })

  test('列界同理', () => {
    const items = sampleItems()
    const cut = gridCuts(ANCHORS.map(a => a.y), items.map(i => i.y))!
    assert.ok(Math.abs(cut.pitch - PITCH_Y) < 0.01)
    // 上排最低的元素 491.77、下排最高的 425.75
    assert.ok(cut.cut > 425.75 && cut.cut < 491.77, `列界 ${cut.cut}`)
  })

  test('只有一張面單時不切 —— 整頁就是一格', () => {
    assert.equal(gridCuts([108.54], [45.51, 108.54, 232.34]), null)
  })

  test('佔用範圍比間距還寬就放棄，不亂切', () => {
    // 錨點間距 50，但元素散佈 200 —— 判斷一定有問題
    assert.equal(gridCuts([0, 50], [-100, 0, 50, 100]), null)
  })

  test('缺格時用最小的錨點間距', () => {
    // 4 格只印了第 1、2、4 張：x 錨點是 0、246、492，間距取 246
    const xs = [0, 246, 492]
    const positions = xs.flatMap(x => [x - 60, x, x + 120])
    const cut = gridCuts(xs, positions)!
    assert.ok(Math.abs(cut.pitch - 246) < 0.01, `間距 ${cut.pitch}`)
  })
})

describe('面單拆檔：歸格', () => {
  test('每張面單拿到自己的元素，一個不多一個不少', () => {
    const items = sampleItems()
    const layout = pageLayout(items)
    assert.equal(layout.anchors.length, 3)

    for (const a of layout.anchors) {
      const kept = items.filter(i => layout.belongsTo(i, a.cell))
      // 自己那張面單的 12 個元素 ＋ 7 個頁首頁尾
      assert.equal(kept.length, OFFSETS.length + FURNITURE.length, `${a.orderNo} 留下 ${kept.length} 個`)
      const orders = new Set(
        kept.flatMap(i => [...i.text.matchAll(/CM\d{13}/g)].map(m => m[0])),
      )
      assert.deepEqual([...orders], [a.orderNo], `${a.orderNo} 的面單裡混進了別筆訂單`)
    }
  })

  test('頁首頁尾每張都留著 —— 跟現在單張列印的檔案長得一樣', () => {
    const items = sampleItems()
    const layout = pageLayout(items)
    for (const a of layout.anchors) {
      for (const [x, y] of FURNITURE) {
        const f = items.find(i => i.x === x && i.y === y)!
        assert.ok(layout.belongsTo(f, a.cell), `(${x}, ${y}) 被誤刪`)
      }
    }
  })

  test('面單右緣那個字元屬於左欄，不是右欄', () => {
    // dx=123.8 的那個元素就是踩到坑的那一個
    const items = sampleItems()
    const layout = pageLayout(items)
    const left = layout.anchors.find(a => a.orderNo === 'CM2609214719432')!
    const right = layout.anchors.find(a => a.orderNo === 'CM2609214719459')!
    const edge = items.find(i => Math.abs(i.x - (108.54 + 123.8)) < 0.01 && Math.abs(i.y - (540.54 + 212.35)) < 0.01)!
    assert.ok(layout.belongsTo(edge, left.cell))
    assert.ok(!layout.belongsTo(edge, right.cell))
  })

  test('只有一張面單時所有元素都留著', () => {
    const items = sampleItems().filter(i => i.x < 260 && i.y > 440)
    const layout = pageLayout(items)
    assert.equal(layout.anchors.length, 1)
    for (const i of items) assert.ok(layout.belongsTo(i, layout.anchors[0].cell))
  })

  test('cellIndex 以界線為準，界線左邊小一格', () => {
    assert.equal(cellIndex(100, 246.11, 261.98), -1)
    assert.equal(cellIndex(300, 246.11, 261.98), 0)
    assert.equal(cellIndex(261.98, 246.11, 261.98), 0)
  })
})

// ── 合成一份最小的 PDF，走完整條產出路徑 ────────────────
// 重點是驗自己手寫的 xref：位移算錯的話，檔案打開會是壞的，但
// 只看內容串流是看不出來的。

function buildTestPdf(labels: { no: string; x: number; y: number }[]): Uint8Array {
  const chars = [...new Set(labels.flatMap(l => [...`${l.no}-0`]))]
  const code = new Map(chars.map((c, i) => [c, i + 1]))
  const bfchar = chars
    .map(c => `<${code.get(c)!.toString(16).padStart(4, '0')}> <${c.charCodeAt(0).toString(16).padStart(4, '0')}>`)
    .join('\n')
  const cmap =
    `/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n` +
    `1 begincodespacerange <0000> <FFFF> endcodespacerange\n` +
    `${chars.length} beginbfchar\n${bfchar}\nendbfchar\nendcmap end end`

  const body = labels.map(l => {
    const hex = [...`${l.no}-0`].map(c => code.get(c)!.toString(16).padStart(4, '0')).join('')
    return `BT\n/F1 10 Tf\n1 0 0 1 ${l.x} ${l.y} Tm\n<${hex}> Tj\nET\n` +
      // 每張面單再加一個固定位移的元素，格線才算得出佔用範圍
      `BT\n/F1 10 Tf\n1 0 0 1 ${l.x - 40} ${l.y + 60} Tm\n<${code.get(chars[0])!.toString(16).padStart(4, '0')}> Tj\nET\n`
  }).join('')
  const content = `q\n1 0 0 1 0 0 cm\n${body}Q\n`

  const objs: string[] = []
  objs[1] = `<</Type /Catalog\n/Pages 2 0 R>>`
  objs[2] = `<</Type /Pages\n/Count 1\n/Kids [3 0 R]>>`
  objs[3] = `<</Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 595 842]\n/Resources <</Font <</F1 4 0 R>>>>\n/Contents 6 0 R>>`
  objs[4] = `<</Type /Font\n/Subtype /Type0\n/BaseFont /Test\n/Encoding /Identity-H\n/DescendantFonts [7 0 R]\n/ToUnicode 5 0 R>>`
  objs[7] = `<</Type /Font\n/Subtype /CIDFontType2\n/BaseFont /Test\n/CIDSystemInfo <</Registry (Adobe) /Ordering (Identity) /Supplement 0>>>>`

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  const emit = (n: number, s: string) => { offsets[n] = out.length; out += `${n} 0 obj\n${s}\nendobj\n` }
  emit(1, objs[1]); emit(2, objs[2]); emit(3, objs[3]); emit(4, objs[4])
  offsets[5] = out.length
  out += `5 0 obj\n<</Length ${cmap.length}>>\nstream\n${cmap}\nendstream\nendobj\n`
  const packed = zlibSync(new TextEncoder().encode(content), { level: 6 })
  let packedStr = ''
  for (const b of packed) packedStr += String.fromCharCode(b)
  offsets[6] = out.length
  out += `6 0 obj\n<</Filter /FlateDecode /Length ${packed.length}>>\nstream\n${packedStr}\nendstream\nendobj\n`
  emit(7, objs[7])

  const xref = out.length
  out += `xref\n0 8\n0000000000 65535 f \n`
  for (let i = 1; i <= 7; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<</Size 8\n/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`

  const bytes = new Uint8Array(out.length)
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return bytes
}

describe('面單拆檔：產出的檔案', () => {
  const labels = [
    { no: 'CM2609214719432', x: 100, y: 600 },
    { no: 'CM2609214719459', x: 350, y: 600 },
    { no: 'CM2609214719479', x: 100, y: 250 },
  ]

  test('三張面單拆成三個檔，每個檔只有一個訂單號', () => {
    const result = splitLabelPdf(buildTestPdf(labels))
    assert.deepEqual(result.labels.map(l => l.orderNo), labels.map(l => l.no))
    assert.deepEqual(result.warnings, [])
    // splitLabelPdf 內部已經驗過一次；這裡再從外面確認一次
    for (const l of result.labels) {
      const re = parsePdf(l.pdf)
      assert.equal(re.pageNums.length, 1, `${l.orderNo} 應該只有一頁`)
    }
  })

  test('產出的 PDF 仍是合法結構：xref 位移指得到每一個物件', () => {
    const result = splitLabelPdf(buildTestPdf(labels))
    const bytes = result.labels[0].pdf
    let text = ''
    for (const b of bytes) text += String.fromCharCode(b)

    // 最後一段 xref 的每一筆位移都要正好落在 "N 0 obj" 上
    const tail = text.slice(text.lastIndexOf('\nxref\n'))
    const startM = /startxref\s+(\d+)/.exec(tail)!
    assert.ok(Number(startM[1]) > 0 && Number(startM[1]) < bytes.length, 'startxref 超出檔案')

    // xref 必須從 0 號起算，否則有些解析器會把物件編號整個位移一格
    assert.match(tail, /^\nxref\n0 1\n0000000000 65535 f /)

    const rows = [...tail.matchAll(/^(\d{10}) 00000 n $/gm)]
    assert.ok(rows.length >= 2, '至少要有內容串流與 /Pages 兩筆')
    for (const r of rows) {
      const at = Number(r[1])
      assert.match(text.slice(at, at + 20), /^\d+ 0 obj/, `位移 ${at} 沒有指到物件`)
    }
  })

  test('原始檔的位元組完整保留在前面 —— 字型與圖片不會被動到', () => {
    const src = buildTestPdf(labels)
    const out = splitLabelPdf(src).labels[0].pdf
    assert.deepEqual(out.slice(0, src.length), src)
  })

  test('單張列印的 PDF 丟進來也能用，內容原封不動', () => {
    const one = [{ no: 'CM2609153757468', x: 100, y: 600 }]
    const result = splitLabelPdf(buildTestPdf(one))
    assert.equal(result.labels.length, 1)
    assert.equal(result.labels[0].orderNo, 'CM2609153757468')
  })

  test('沒有面單的 PDF 會說清楚，不是回空清單', () => {
    const blank = buildTestPdf([{ no: 'XX2609214719432', x: 100, y: 600 }])
    assert.throws(() => splitLabelPdf(blank), (e: Error) => {
      assert.ok(e instanceof LabelPdfError)
      assert.match(e.message, /找不到任何面單/)
      return true
    })
  })

  test('不是 PDF 就擋下來', () => {
    assert.throws(() => splitLabelPdf(new TextEncoder().encode('PK\x03\x04 這是 zip')), LabelPdfError)
  })

  test('檔名就是訂單號 —— 新比銳靠檔名認訂單', () => {
    assert.equal(labelFileName('CM2609214719432'), 'CM2609214719432.pdf')
  })
})

describe('面單拆檔：內容串流掃描', () => {
  const fonts = new Map([['F1', { cmap: new Map([[0x41, 'A'], [0x42, 'B']]), twoByte: true }]])

  test('Tm 位置會乘上目前的 CTM', () => {
    const content = 'q 2 0 0 2 10 20 cm BT /F1 10 Tf 1 0 0 1 5 5 Tm <0041> Tj ET Q'
    const items = scanDrawItems(content, fonts)
    assert.equal(items.length, 1)
    assert.equal(items[0].text, 'A')
    assert.deepEqual([items[0].x, items[0].y], [20, 30])
  })

  test('Q 之後 CTM 回到原狀', () => {
    const content =
      'q 2 0 0 2 10 20 cm BT /F1 10 Tf 1 0 0 1 5 5 Tm <0041> Tj ET Q ' +
      'BT /F1 10 Tf 1 0 0 1 5 5 Tm <0042> Tj ET'
    const items = scanDrawItems(content, fonts)
    assert.deepEqual([items[1].x, items[1].y], [5, 5])
  })

  test('圖片取單位方框的中心點', () => {
    const items = scanDrawItems('q 100 0 0 50 10 20 cm /X9 Do Q', fonts)
    assert.equal(items.length, 1)
    assert.equal(items[0].kind, 'image')
    assert.deepEqual([items[0].x, items[0].y], [60, 45])
  })

  test('刪圖片時連 /X9 一起刪，不留下沒有 Do 的孤兒', () => {
    const content = 'q 100 0 0 50 10 20 cm /X9 Do Q'
    const item = scanDrawItems(content, fonts)[0]
    assert.equal(content.slice(item.start, item.end), '/X9 Do')
  })

  test('一個文字物件出現多個 Tm 會被標記出來', () => {
    const content = 'BT /F1 10 Tf 1 0 0 1 5 5 Tm <0041> Tj 1 0 0 1 90 90 Tm <0042> Tj ET'
    assert.equal(scanDrawItems(content, fonts)[0].multiTm, true)
  })

  test('TJ 陣列裡的字串也讀得到', () => {
    const items = scanDrawItems('BT /F1 10 Tf 1 0 0 1 5 5 Tm [<0041> -250 <0042>] TJ ET', fonts)
    assert.equal(items[0].text, 'AB')
  })
})
