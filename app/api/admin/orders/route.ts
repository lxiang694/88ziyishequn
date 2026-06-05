import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminMiddleware'

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
  const search = searchParams.get('search') || ''
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

  if (dateRange === 'today') {
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
  return NextResponse.json({ success: true, data: data || [], total: count || 0, page, limit })
}
