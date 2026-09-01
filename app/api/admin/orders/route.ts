import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'
import {
  sanitizeOrderSearch, shouldApplyDateFilter, isDateFilterOverridden,
} from '@/lib/adminOrderSearch'

function twDayToUTC(dateStr: string, isEnd: boolean): string {
  const time = isEnd ? 'T23:59:59' : 'T00:00:00'
  return new Date(dateStr + time + '+08:00').toISOString()
}

function getTWToday(): string {
  const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return nowTW.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  // 使用者輸入會被組進 PostgREST 的 or() 語法，逗號與括號會破壞結構，
  // % 與 _ 是 LIKE 萬用字元 —— 輸入一個 % 就會撈出全部訂單
  const search = sanitizeOrderSearch(searchParams.get('search'))
  const status = searchParams.get('status') || ''
  const dateRange = searchParams.get('dateRange') || ''
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const todayTW = getTWToday()

  let query = supabaseAdmin
    .from('orders')
    .select('id, order_no, customer_name, phone, store_name, order_status, items_count, total_amount, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) query = query.or(`order_no.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`)
  if (status) query = query.eq('order_status', status)

  // 搜尋訂單號／姓名／手機時不套用期間篩選 —— 那是「找特定一筆」，
  // 不是瀏覽某個期間。從儀表板「本月訂單」進來時 dateRange=month 會留著，
  // 以前會導致搜舊訂單永遠找不到，而畫面上沒有任何提示。
  const applyDate = shouldApplyDateFilter(search, dateRange)

  if (!applyDate) {
    // 不加任何日期條件
  } else if (dateRange === 'today') {
    query = query.gte('created_at', twDayToUTC(todayTW, false)).lte('created_at', twDayToUTC(todayTW, true))
  } else if (dateRange === 'yesterday') {
    const yd = new Date(Date.now() + 8 * 60 * 60 * 1000)
    yd.setDate(yd.getDate() - 1)
    const ydStr = yd.toISOString().slice(0, 10)
    query = query.gte('created_at', twDayToUTC(ydStr, false)).lte('created_at', twDayToUTC(ydStr, true))
  } else if (dateRange === '3days') {
    const d3 = new Date(Date.now() + 8 * 60 * 60 * 1000)
    d3.setDate(d3.getDate() - 2)
    query = query.gte('created_at', twDayToUTC(d3.toISOString().slice(0, 10), false))
  } else if (dateRange === 'month') {
    query = query.gte('created_at', twDayToUTC(todayTW.slice(0, 7) + '-01', false))
  } else if (dateRange === 'custom' && startDate && endDate) {
    query = query.gte('created_at', twDayToUTC(startDate, false)).lte('created_at', twDayToUTC(endDate, true))
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const dateFilterOverridden = isDateFilterOverridden(search, dateRange)

  const rows = data || []

  // 以手機號為客戶識別，算出「這筆是該客戶第幾次購買」與「累計購買次數」（不計已取消）
  const phones = Array.from(new Set(rows.map((r: any) => r.phone).filter(Boolean)))
  const seqByOrderId: Record<string, number> = {}
  const totalByPhone: Record<string, number> = {}
  if (phones.length > 0) {
    const { data: history } = await supabaseAdmin
      .from('orders')
      .select('id, phone, created_at')
      .in('phone', phones)
      .neq('order_status', '已取消')
      .order('created_at', { ascending: true })
    for (const o of history || []) {
      const p = (o as any).phone
      totalByPhone[p] = (totalByPhone[p] || 0) + 1
      seqByOrderId[(o as any).id] = totalByPhone[p]
    }
  }

  const withSeq = rows.map((r: any) => ({
    ...r,
    purchase_seq: seqByOrderId[r.id] ?? null,        // 這筆是第幾次購買（已取消的訂單為 null）
    customer_orders: totalByPhone[r.phone] ?? 0,      // 該客戶累計購買次數
  }))

  return NextResponse.json({
    success: true, data: withSeq, total: count || 0, page, limit,
    // 讓畫面能提示「搜尋時已忽略期間篩選」，避免使用者以為篩選還在作用
    date_filter_overridden: dateFilterOverridden,
  })
}
