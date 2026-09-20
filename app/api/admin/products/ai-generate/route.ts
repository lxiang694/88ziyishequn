import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/adminMiddleware'

export async function POST(req: NextRequest) {
  const auth = requirePermission(req, 'products.all')
  if (auth instanceof NextResponse) return auth

  try {
    const { product_name, product_id, type } = await req.json()

    if (!product_name) {
      return NextResponse.json({ success: false, error: '請提供商品名稱' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: '未設定 AI API 金鑰' }, { status: 500 })
    }

    let prompt = ''
    if (type === 'short_intro') {
      prompt = `你是一位台灣保健品電商文案撰寫師。請為以下保健品撰寫一句話的商品簡介，要求：
1. 不超過30個字
2. 自然白話、適合台灣消費者
3. 不誇大療效，不做醫療宣稱
4. 點出商品主要用途或特色

商品名稱：${product_name}

請直接輸出一句話簡介，不要加任何說明或標點符號前綴。`
    } else if (type === 'suitable_people') {
      prompt = `你是一位台灣保健品電商文案撰寫師。請為以下保健品撰寫「適合人群」說明。

商品名稱：${product_name}

【格式】必須嚴格遵守，這段文字會直接顯示在商品頁：
- 只輸出 3 到 4 行，每行一個族群
- 每行都以「- 」開頭
- 每行不超過 25 個字
- 不要寫開場白、不要寫結語、不要寫成段落
- 族群之間不可以重複描述同一種人

【用詞規範】台灣《食品安全衛生管理法》第 28 條：
食品不得為醫療效能之標示、宣傳或廣告。

絕對不可出現：治療、改善、預防、療效、增強免疫、提升抵抗力、
防護、調理、修復、降血糖、降血脂、護肝、排毒、抗發炎、
幫助維持某個器官或生理機能。

只能描述「這個人的生活型態或飲食狀況」，不能描述「吃了會怎樣」。

正確範例：
- 三餐外食、蔬果吃得少的人
- 作息不規律、常熬夜的上班族
- 想補充日常基礎營養的人
- 平時較少曬太陽的人

錯誤範例（不可模仿）：
- 想增強免疫力的人          ← 醫療效能宣稱
- 需要調理體質的人          ← 醫療效能宣稱
- 希望幫助維持骨骼健康的人  ← 生理機能宣稱

請直接輸出 3-4 行，不要加任何額外說明。`
    } else {
      prompt = `你是一位台灣保健品電商文案撰寫師。請為以下保健品分別撰寫：
1. 一句話簡介（不超過 30 字，自然白話，點出主要特色）
2. 適合人群（3-4 行，每行一個族群，每行以「- 」開頭、不超過 25 字，
   不可重複描述同一種人，不要寫成段落）

商品名稱：${product_name}

【用詞規範】台灣《食品安全衛生管理法》第 28 條：
食品不得為醫療效能之標示、宣傳或廣告。

絕對不可出現：治療、改善、預防、療效、增強免疫、提升抵抗力、
防護、調理、修復、降血糖、降血脂、護肝、排毒、抗發炎、
幫助維持某個器官或生理機能。

適合人群只能描述「這個人的生活型態或飲食狀況」，
不能描述「吃了會怎樣」。例如「三餐外食、蔬果吃得少的人」可以，
「想增強免疫力的人」不可以。

請以以下格式輸出，不要其他說明：
【一句話簡介】
（內容）
【適合人群】
（內容）`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'AI 生成失敗，請稍後再試' }, { status: 500 })
    }

    const aiData = await response.json()
    const output = aiData.content?.[0]?.text || ''

    // Parse output
    let short_intro = ''
    let suitable_people = ''

    if (type === 'short_intro') {
      short_intro = output.trim()
    } else if (type === 'suitable_people') {
      suitable_people = output.trim()
    } else {
      const introMatch = output.match(/【一句話簡介】\s*([\s\S]*?)(?=【適合人群】|$)/)
      const peopleMatch = output.match(/【適合人群】\s*([\s\S]*)$/)
      short_intro = introMatch?.[1]?.trim() || ''
      suitable_people = peopleMatch?.[1]?.trim() || ''
    }

    // Log the generation
    if (product_id) {
      await supabaseAdmin.from('ai_generation_logs').insert({
        product_id,
        generation_type: type,
        input_text: product_name,
        output_text: output,
      })
    }

    return NextResponse.json({
      success: true,
      data: { short_intro, suitable_people, raw: output },
    })
  } catch (err) {
    console.error('AI generation error:', err)
    return NextResponse.json({ success: false, error: 'AI 生成失敗' }, { status: 500 })
  }
}
