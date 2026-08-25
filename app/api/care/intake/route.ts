import { NextRequest, NextResponse } from 'next/server'
import { parsePublicIntake } from '@/lib/care/validation'
import { createCareIntakeFromPublicRequest } from '@/lib/care/service'
import { careErrorResponse, getClientIp } from '@/lib/care/http'

export const runtime = 'nodejs'

/**
 * 公開的需求初評送出端點（匿名可用）。
 *
 * 安全性要點：
 *  - 只接受 parsePublicIntake() 白名單欄位；status/source/ip 由伺服器決定
 *  - 以 IP 雜湊做每小時上限（Service 層），不存原始 IP
 *  - 成功時只回 { success: true }，不回 internal id、不回任何既有資料
 *  - 沒有 GET：公開端不得查詢任何初評
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const input = parsePublicIntake(body)
    await createCareIntakeFromPublicRequest(input, getClientIp(req))
    // 刻意不回傳識別碼或任何可列舉的資訊
    return NextResponse.json({ success: true })
  } catch (e) {
    return careErrorResponse(e)
  }
}
