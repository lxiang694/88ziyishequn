import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminMiddleware'
import { buildCustomers, contactOutcome, filterList, summarizeCustomers, winBackMessage, STATUS_LABEL, type ListKey } from '@/lib/crm'
import { loadCustomerOrders, loadLatestContacts } from '@/lib/crmRepo'
import { SITE_URL } from '@/lib/siteUrl'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const LISTS: ListKey[] = ['core', 'due', 'dormant', 'lost', 'one_time', 'all']
const PAGE = 30

/**
 * 後台「客戶經營」：客人總覽、各行動名單（附 LINE 訊息草稿與聯繫狀態）、挽回成效。
 * 客戶的手機、消費屬於敏感資料：需要「查看訂單」權限或超級管理員。
 */
export async function GET(req: NextRequest) {
  const auth = requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { admin } = auth
  if (!admin.permissions.includes('all') && !admin.permissions.includes('orders.view') && admin.role_key !== 'customer_service') {
    return NextResponse.json({ success: false, error: '無權限查看客戶資料' }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  const list = (LISTS.includes(sp.get('list') as ListKey) ? sp.get('list') : 'due') as ListKey
  const q = (sp.get('q') || '').trim().toLowerCase().slice(0, 30)
  const page = Math.max(1, Number(sp.get('page')) || 1)

  let loaded
  try { loaded = await loadCustomerOrders() } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : '讀取失敗' }, { status: 500 })
  }
  const now = Date.now()
  const [{ customers, globalCycle }, contacts] = await Promise.all([
    Promise.resolve(buildCustomers(loaded.orders, now)),
    loadLatestContacts(),
  ])
  const summary = summarizeCustomers(customers, globalCycle)

  // 挽回成效：近 60 天聯繫過的人，之後有沒有回來買
  const byPhone = new Map(customers.map(c => [c.phone, c]))
  const effect = { contacted: 0, won: 0, waiting: 0, no_response: 0, won_revenue: 0 }
  for (const [phone, row] of contacts.latest) {
    if (now - new Date(row.contacted_at).getTime() > 60 * 86_400_000) continue
    const c = byPhone.get(phone)
    if (!c) continue
    effect.contacted++
    const outcome = contactOutcome(c.last_at, row.contacted_at, now)
    effect[outcome]++
    if (outcome === 'won') effect.won_revenue += c.spend_90d
  }

  const counts = Object.fromEntries(LISTS.map(k => [k, filterList(customers, k).length])) as Record<ListKey, number>
  let rows = filterList(customers, list)
  if (q) rows = rows.filter(c => c.phone.includes(q) || c.name.toLowerCase().includes(q) || c.line_id.toLowerCase().includes(q))

  const decorate = (c: (typeof rows)[number]) => {
    const contact = contacts.latest.get(c.phone)
    return {
      ...c,
      status_label: STATUS_LABEL[c.status],
      message: winBackMessage(c, list, SITE_URL),
      contact: contact ? { ...contact, outcome: contactOutcome(c.last_at, contact.contacted_at, now) } : null,
    }
  }

  // 匯出整份名單（Excel 可開的 CSV，含 BOM 才不會亂碼）
  if (sp.get('format') === 'csv') {
    const head = ['姓名', '手機', 'LINE ID', '狀態', '幾天沒買', '購買次數', '其中團購', '累計消費', '最近買的商品', '常買商品', '最近聯繫']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = rows.map(decorate).map(c => [c.name, c.phone, c.line_id, c.status_label, c.days_since, c.orders, c.group_buy_orders, c.spend,
      c.last_items.join('、'), c.favorite_items.join('、'), c.contact ? c.contact.contacted_at.slice(0, 10) : ''].map(esc).join(','))
    return new NextResponse('﻿' + [head.map(esc).join(','), ...lines].join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="customers-${list}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      summary, counts, effect,
      contacts_ready: contacts.ready,
      group_buy_included: loaded.groupBuyIncluded,
      list, total: rows.length, page, page_size: PAGE,
      rows: rows.slice((page - 1) * PAGE, page * PAGE).map(decorate),
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
