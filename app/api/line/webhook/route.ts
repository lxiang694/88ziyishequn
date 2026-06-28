import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { extractCode, REFERRAL_POINTS } from '@/lib/referral'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || ''
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
// 加入官方帳號後要一併推給朋友的社群連結（選填）
const COMMUNITY_URL = process.env.NEXT_PUBLIC_LINE_COMMUNITY_URL || ''

/** 驗證 LINE 簽章（HMAC-SHA256 + base64） */
function verifySignature(body: string, signature: string | null): boolean {
  if (!CHANNEL_SECRET || !signature) return false
  const hash = crypto.createHmac('sha256', CHANNEL_SECRET).update(body).digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))
  } catch {
    return false
  }
}

/** 回覆訊息給使用者 */
async function reply(replyToken: string, messages: any[]) {
  if (!ACCESS_TOKEN) return
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages }),
    })
  } catch (e) {
    console.warn('[LINE] reply failed', e)
  }
}

function textMsg(text: string) {
  return { type: 'text', text }
}

// 加入官方帳號 / 送出邀請碼成功後，附上社群連結（若有設定）
function withCommunity(messages: any[]): any[] {
  if (COMMUNITY_URL) {
    messages.push(textMsg(`順手加入我們的健康社群，每天分享保健新知 👇\n${COMMUNITY_URL}`))
  }
  return messages
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature')

  // 未設定 secret（尚未上線）→ 直接回 200，讓 LINE 後台 Verify 能通過
  if (!CHANNEL_SECRET) {
    return NextResponse.json({ ok: true, note: 'webhook not configured' })
  }

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const events: any[] = payload?.events || []

  for (const event of events) {
    try {
      const lineUserId: string | undefined = event?.source?.userId
      const replyToken: string | undefined = event?.replyToken

      // A. 加好友事件：歡迎，並引導輸入邀請碼
      if (event.type === 'follow' && replyToken) {
        await reply(
          replyToken,
          withCommunity([
            textMsg(
              '歡迎加入！🎉\n如果你是朋友邀請來的，請把朋友給你的「邀請碼」直接貼上來送出，' +
                `你的朋友就能獲得 ${REFERRAL_POINTS} 積分回饋。`
            ),
          ])
        )
        continue
      }

      // B. 文字訊息：嘗試解析邀請碼並發分
      if (event.type === 'message' && event.message?.type === 'text' && lineUserId) {
        const code = extractCode(event.message.text || '')
        if (!code) continue // 不是邀請碼，忽略（不打擾使用者）

        const { data, error } = await supabaseAdmin.rpc('redeem_referral', {
          p_code: code,
          p_line_user_id: lineUserId,
          p_points: REFERRAL_POINTS,
        })

        if (error) {
          console.warn('[LINE] redeem_referral error', error)
          continue
        }

        const status = (data as any)?.status
        if (!replyToken) continue

        if (status === 'rewarded') {
          await reply(
            replyToken,
            withCommunity([
              textMsg(`收到了！已通知邀請你的朋友獲得 ${REFERRAL_POINTS} 積分 🎁\n感謝你的加入 💚`),
            ])
          )
        } else if (status === 'already_referred') {
          await reply(replyToken, [
            textMsg('你已經完成過好友禮囉，無法重複領取 😊'),
          ])
        }
        // invalid_code：可能只是一般訊息剛好像邀請碼，不回覆以免打擾
        continue
      }
    } catch (e) {
      console.warn('[LINE] event handling error', e)
    }
  }

  // LINE 規定一律回 200
  return NextResponse.json({ ok: true })
}

// LINE 後台「Verify」按鈕會發 GET/HEAD，回 200 即可
export async function GET() {
  return NextResponse.json({ ok: true })
}
