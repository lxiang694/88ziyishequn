'use client'
import { useState, useEffect, useCallback } from 'react'
import { formatDateTime } from '@/lib/utils'
import { AUDIT_ACTION_LABELS, isDownloadAction } from '@/lib/permissions'

const SEEN_KEY = 'audit_downloads_seen_at'

const SCOPES = [
  { value: 'all', label: '全部' },
  { value: 'downloads', label: '資料下載' },
  { value: 'views', label: '頁面瀏覽' },
]

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [admins, setAdmins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [scope, setScope] = useState('all')
  const [adminId, setAdminId] = useState('')
  const [date, setDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ scope })
    if (adminId) params.set('adminId', adminId)
    if (date) params.set('date', date)
    const res = await fetch('/api/admin/audit?' + params)
    if (res.status === 403) { setDenied(true); setLoading(false); return }
    const d = await res.json()
    if (d.success) setLogs(d.data)
    setLoading(false)
  }, [scope, adminId, date])

  useEffect(() => {
    // 進入稽核頁即視為已檢視所有下載提示，清除徽章
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    window.dispatchEvent(new Event('audit-seen'))
    fetch('/api/admin/users').then(r => r.json()).then(d => { if (d.success) setAdmins(d.data) }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  if (denied) {
    return (
      <div className="py-20 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <p className="text-gray-500">此功能僅限超級管理員</p>
      </div>
    )
  }

  const downloadCount = logs.filter(l => isDownloadAction(l.action)).length

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">操作稽核日誌</h1>
        <p className="text-gray-600 text-sm mt-0.5">追蹤各管理員的後台瀏覽與資料下載紀錄</p>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {SCOPES.map(s => (
            <button key={s.value} onClick={() => setScope(s.value)}
              className={'px-3 py-2 rounded-xl text-sm font-bold transition-colors ' + (scope === s.value ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {s.label}
            </button>
          ))}
        </div>
        <select className="form-input sm:w-44" value={adminId} onChange={e => setAdminId(e.target.value)} style={{ height: '42px' }}>
          <option value="">全部管理員</option>
          {admins.map(a => <option key={a.id} value={a.id}>{a.name}（{a.account}）</option>)}
        </select>
        <input type="date" className="form-input sm:w-44" style={{ height: '42px' }} value={date} onChange={e => setDate(e.target.value)} />
        {(adminId || date || scope !== 'all') && (
          <button onClick={() => { setScope('all'); setAdminId(''); setDate('') }} className="text-sm text-gray-500 hover:text-gray-700 font-semibold px-2">清除篩選</button>
        )}
      </div>

      {loading ? (
        <div className="card py-16 text-center text-gray-600">載入中...</div>
      ) : logs.length === 0 ? (
        <div className="card py-16 text-center text-gray-600">此條件下沒有紀錄</div>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-3">
            共 {logs.length} 筆{downloadCount > 0 && <span className="text-red-500 font-bold">・其中 {downloadCount} 筆資料下載</span>}
          </p>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['時間', '管理員', '操作', '詳情', 'IP'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-bold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const isDl = isDownloadAction(l.action)
                    return (
                      <tr key={l.id} className={'border-b border-gray-100 ' + (isDl ? 'bg-red-50/60' : 'hover:bg-gray-50')}>
                        <td className="px-4 py-3 text-gray-500 text-[13px] whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-gray-800">{l.admin_name}</span>
                          <span className="text-gray-600 text-[13px] ml-1">{l.admin_account}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={'text-[13px] font-bold px-2 py-1 rounded-full ' + (isDl ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>
                            {isDl && '⚠️ '}{AUDIT_ACTION_LABELS[l.action] || l.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{l.detail || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-[13px] whitespace-nowrap">{l.ip || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
