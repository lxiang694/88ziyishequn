'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { TW_COUNTIES } from '@/lib/careMeta'

interface Companion {
  id: number; name: string; phone: string; email: string | null; gender: string | null
  employment_type: string; service_areas: string[]; certifications: string | null
  bio: string | null; status: string; completed_count: number; admin_note: string | null
}

const STATUS_LABEL: Record<string, string> = { pending: '待審核', active: '啟用中', suspended: '已停用' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-gray-200 text-gray-700',
}

const emptyForm = {
  name: '', phone: '', password: '', email: '', gender: 'female',
  employment_type: 'parttime', service_areas: [] as string[], certifications: '', bio: '',
}

export default function AdminCompanionsPage() {
  const [rows, setRows] = useState<Companion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/care/companions')
      .then(r => r.json())
      .then(d => {
        if (d.success) { setRows(d.data); setTableMissing(!!d.table_missing) }
        else toast.error(d.error || '載入失敗')
        setLoading(false)
      })
      .catch(() => { toast.error('載入失敗'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const toggleArea = (c: string) =>
    setForm(f => ({ ...f, service_areas: f.service_areas.includes(c) ? f.service_areas.filter(x => x !== c) : [...f.service_areas, c] }))

  const create = async () => {
    if (!form.name || !form.phone || !form.password) return toast.error('請填寫姓名、手機與密碼')
    setSaving(true)
    const res = await fetch('/api/admin/care/companions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (d.success) { toast.success('陪診員已建立'); setForm({ ...emptyForm }); setShowForm(false); load() }
    else toast.error(d.error || '建立失敗')
  }

  const patch = async (id: number, body: any) => {
    const res = await fetch('/api/admin/care/companions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }),
    })
    const d = await res.json()
    if (d.success) { toast.success('已更新'); load() } else toast.error(d.error || '更新失敗')
  }

  const resetPassword = async (c: Companion) => {
    const pw = prompt(`為「${c.name}」設定新密碼（至少 6 碼）：`)
    if (!pw) return
    patch(c.id, { password: pw })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">👥 陪診員管理</h1>
          <p className="text-gray-600 text-sm mt-0.5">共 {rows.length} 位・帳號為手機號碼，登入網址 /companion/login</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary">
          {showForm ? '取消' : '＋ 新增陪診員'}
        </button>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
          ⚠️ 尚未建立陪診資料表，請先執行 <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded">migrations/companion_care_schema.sql</code>
        </div>
      )}

      {showForm && (
        <div className="card p-5 mb-5 space-y-4">
          <h2 className="font-bold text-gray-800 text-lg">新增陪診員帳號</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">姓名 *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">手機（即登入帳號）*</label>
              <input className="form-input" placeholder="09xxxxxxxx" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">初始密碼 *</label>
              <input className="form-input" placeholder="至少 6 碼" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">性別</label>
              <select className="form-input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="female">女性</option>
                <option value="male">男性</option>
              </select>
            </div>
            <div>
              <label className="form-label">聘用型態</label>
              <select className="form-input" value={form.employment_type}
                onChange={e => setForm(f => ({ ...f, employment_type: e.target.value }))}>
                <option value="parttime">兼職</option>
                <option value="fulltime">全職</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">可服務縣市</label>
            <div className="flex flex-wrap gap-2">
              {TW_COUNTIES.map(c => (
                <button key={c} type="button" onClick={() => toggleArea(c)}
                  className={`px-3 py-2 min-h-[48px] rounded-xl border-2 text-[15px] font-semibold transition-colors ${form.service_areas.includes(c) ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">證照 / 專業背景</label>
            <input className="form-input" placeholder="例：照顧服務員結訓、CPR+AED、護理背景"
              value={form.certifications} onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))} />
          </div>
          <button onClick={create} disabled={saving} className="btn-primary w-full">
            {saving ? '建立中…' : '建立帳號'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-gray-600">載入中…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-600">尚未有陪診員，點右上角新增</div>
      ) : (
        <div className="space-y-3">
          {rows.map(c => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-lg">{c.name}</p>
                    <span className={'status-badge ' + (STATUS_COLOR[c.status] || '')}>{STATUS_LABEL[c.status] || c.status}</span>
                    <span className="text-[13px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-semibold">
                      {c.employment_type === 'fulltime' ? '全職' : '兼職'}
                    </span>
                  </div>
                  <p className="text-gray-700 font-mono text-base mt-1">{c.phone}</p>
                  {Array.isArray(c.service_areas) && c.service_areas.length > 0 && (
                    <p className="text-gray-600 text-sm mt-1">服務區域：{c.service_areas.join('、')}</p>
                  )}
                  {c.certifications && <p className="text-gray-600 text-sm mt-0.5">證照：{c.certifications}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-gray-900 font-bold text-lg">{c.completed_count}</p>
                  <p className="text-gray-600 text-[13px]">已完成場次</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {c.status !== 'active' && (
                  <button onClick={() => patch(c.id, { status: 'active' })}
                    className="px-4 py-2 min-h-[48px] rounded-xl border-2 border-green-600 text-green-700 font-semibold text-[15px] hover:bg-green-50">
                    啟用
                  </button>
                )}
                {c.status === 'active' && (
                  <button onClick={() => patch(c.id, { status: 'suspended' })}
                    className="px-4 py-2 min-h-[48px] rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-[15px] hover:bg-gray-50">
                    停用
                  </button>
                )}
                <button onClick={() => resetPassword(c)}
                  className="px-4 py-2 min-h-[48px] rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-[15px] hover:bg-gray-50">
                  重設密碼
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
