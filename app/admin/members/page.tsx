'use client'
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { formatDateTime, formatPrice } from '@/lib/utils'

interface MemberOrder {
  id: number
  order_no: string
  customer_name: string
  phone: string
  store_name: string | null
  order_status: string
  items_count: number
  total_amount: number
  created_at: string
  is_linked: boolean
  order_items?: {
    id: number; product_name_snapshot: string; variant_name_snapshot: string | null
    unit_price: number; quantity: number; subtotal: number
  }[]
}

export default function MembersPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [keyword, setKeyword] = useState('')

  // 展開的會員與其訂單（一次只展開一位，避免一次拉太多資料）
  const [openId, setOpenId] = useState<string | null>(null)
  const [orders, setOrders] = useState<MemberOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')

  const toggle = useCallback((id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id); setOrders([]); setOrdersError(''); setOrdersLoading(true)
    fetch(`/api/admin/members/${id}/orders`)
      .then(r => r.json())
      .then(d => { d.success ? setOrders(d.data) : setOrdersError(d.error || '載入失敗') })
      .catch(() => setOrdersError('網路錯誤，請稍後再試'))
      .finally(() => setOrdersLoading(false))
  }, [openId])

  useEffect(() => {
    fetch('/api/admin/members')
      .then(r => {
        if (r.status === 403) { setDenied(true); return null }
        return r.json()
      })
      .then(d => { if (d?.success) setData(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const members: any[] = data?.members ?? []
  const summary = data?.summary

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return members
    return members.filter(m =>
      (m.name || '').toLowerCase().includes(k) ||
      (m.phone || '').includes(k) ||
      (m.email || '').toLowerCase().includes(k)
    )
  }, [members, keyword])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">會員管理</h1>
        <p className="text-[13px] text-gray-600">※ 註冊會員資料</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-600 text-lg">載入中...</div>
      ) : denied ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-500">您沒有查看會員資料的權限</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '👥', label: '會員總數', value: summary?.total ?? 0, color: 'bg-green-50 text-green-700 border-green-100' },
              { icon: '🆕', label: '今日新增', value: summary?.new_today ?? 0, color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { icon: '📅', label: '本月新增', value: summary?.new_month ?? 0, color: 'bg-purple-50 text-purple-700 border-purple-100' },
              { icon: '✅', label: '已驗證 Email', value: summary?.verified ?? 0, color: 'bg-orange-50 text-orange-700 border-orange-100' },
            ].map(c => (
              <div key={c.label} className={`card p-5 text-center border ${c.color}`}>
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="text-2xl font-bold">{c.value}</div>
                <div className="text-sm mt-1 opacity-80">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="card p-4">
            <input className="form-input" placeholder="搜尋姓名、手機或 Email..."
              value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>

          {/* Member table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
              共 <span className="font-bold text-gray-800">{filtered.length}</span> 筆
            </div>
            {filtered.length === 0 ? (
              <p className="text-gray-600 text-center py-12">{keyword ? '查無符合的會員' : '暫無註冊會員'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['姓名', '手機', 'Email', '訂單數', '註冊時間', '最後登入', 'Email 驗證'].map(h =>
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(m => (
                      <Fragment key={m.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{m.name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono whitespace-nowrap">{m.phone || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 break-all">{m.email || '—'}</td>
                          <td className="px-4 py-3">
                            {m.order_count > 0 ? (
                              <button onClick={() => toggle(m.id)}
                                className="bg-green-50 text-green-700 font-bold px-2 py-1 rounded-lg hover:bg-green-100 transition-colors">
                                {m.order_count} {openId === m.id ? '▲' : '▼'}
                              </button>
                            ) : (
                              <span className="text-gray-600">0</span>
                            )}
                            {m.guest_order_count > 0 && (
                              <span className="block text-[12px] text-amber-700 mt-1 whitespace-nowrap">
                                含 {m.guest_order_count} 筆未歸屬
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.last_sign_in_at ? formatDateTime(m.last_sign_in_at) : '從未登入'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[13px] font-semibold px-2 py-1 rounded-full ${m.email_confirmed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {m.email_confirmed ? '已驗證' : '未驗證'}
                            </span>
                          </td>
                        </tr>

                        {openId === m.id && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50 px-4 py-4">
                              {ordersLoading ? (
                                <p className="text-gray-500 text-center py-6">載入訂單中…</p>
                              ) : ordersError ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                  <p className="text-red-800 text-sm">{ordersError}</p>
                                </div>
                              ) : orders.length === 0 ? (
                                <p className="text-gray-500 text-center py-6">沒有訂單</p>
                              ) : (
                                <div className="space-y-2">
                                  {orders.map(o => (
                                    <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
                                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                                        <div className="min-w-0">
                                          <p className="font-bold text-gray-800">
                                            {o.order_no}
                                            {!o.is_linked && (
                                              <span className="ml-2 text-[12px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                                未歸屬（靠手機比對）
                                              </span>
                                            )}
                                          </p>
                                          <p className="text-[13px] text-gray-500 mt-0.5">
                                            收件人 {o.customer_name}・{o.phone}
                                            {o.store_name && `・${o.store_name}`}
                                          </p>
                                          <p className="text-[13px] text-gray-500">{formatDateTime(o.created_at)}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="font-bold text-gray-900">{formatPrice(o.total_amount)}</p>
                                          <span className="text-[13px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                            {o.order_status}
                                          </span>
                                        </div>
                                      </div>

                                      {Array.isArray(o.order_items) && o.order_items.length > 0 && (
                                        <div className="border-t border-gray-100 pt-2 space-y-1">
                                          {o.order_items.map(it => (
                                            <div key={it.id} className="flex justify-between gap-3 text-[13px] text-gray-600">
                                              <span className="min-w-0">
                                                {it.product_name_snapshot}
                                                {it.variant_name_snapshot && `（${it.variant_name_snapshot}）`}
                                                <span className="text-gray-400"> × {it.quantity}</span>
                                              </span>
                                              <span className="flex-shrink-0">{formatPrice(it.subtotal)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}

                                  {orders.some(o => !o.is_linked) && (
                                    <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                      「未歸屬」是入會前下的訪客單，靠收件人手機比對出來的。
                                      會員本人在「我的訂單」也看得到，但如果之後改了手機就會消失。
                                      要永久綁定，請在資料庫把該筆的 user_id 設為這位會員的編號。
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
