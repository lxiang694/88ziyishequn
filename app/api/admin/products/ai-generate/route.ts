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
      prompt = `你是一位台灣保健品電商文案撰寫師。請為以下保健品撰寫「適合人群」說明，要求：
1. 列出3-4種適合的族群
2. 自然白話、適合台灣消費者
3. 不誇大療效，不做醫療宣稱
4. 每種族群以「•」開頭，簡短說明

商品名稱：${product_name}

請直接輸出適合人群說明，不要加任何額外說明。`
    } else {
      prompt = `你是一位台灣保健品電商文案撰寫師。請為以下保健品分別撰寫：
1. 一句話簡介（不超過30字，自然白話，點出主要特色）
2. 適合人群（列出3-4種族群，以•開頭）

要求：
- 自然白話、適合台灣消費者
- 不誇大療效，不做醫療宣稱

商品名稱：${product_name}

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
