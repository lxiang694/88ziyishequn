'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { POLICY_KIND_LABELS, POLICY_STATUS_LABELS, labelOf } from '@/lib/care/operations/labels'

interface Row {
  id: number; policy_kind: string; version_label: string; status: string
  body_text: string | null; published_at: string | null; created_at: string
}

const KINDS = Object.keys(POLICY_KIND_LABELS)

export default function CarePoliciesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState(KINDS[0])
  const [label, setLabel] = useState('')
  const [body, setBody] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/admin/care/policies').then(r => r.json())
      .then(d => { d.success ? setRows(d.data) : setError(d.error || '載入失敗'); setLoading(false) })
      .catch(() => { setError('網路錯誤，請稍後再試'); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (url: string, b: Record<string, unknown>, msg: string) => {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '操作失敗')
    toast.success(msg); setLabel(''); setBody(''); load()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">📄 條款與隱私版本</h1>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
        <p className="font-bold text-amber-900 text-sm mb-1">⚠️ 正文必須由營運與法務提供</p>
        <p className="text-sm text-amber-800">
          系統只負責版本管理與接受紀錄，**不會**代寫條款，也不判斷任何內容是否具備法律效力。
          在正文填入並發布之前，上線檢核會一直標示為待處理。
        </p>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-5 space-y-2">
        <p className="font-semibold text-gray-800 text-sm">建立新版本草稿</p>
        <select value={kind} onChange={e => setKind(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full">
          {KINDS.map(k => <option key={k} value={k}>{POLICY_KIND_LABELS[k]}</option>)}
        </select>
        <input value={label} onChange={e => setLabel(e.target.value)}
          placeholder="版本標籤，例如 2026-09-v1"
          className="border rounded-lg px-3 py-2 text-sm w-full" />
        <textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder="正文（由法務提供，貼上即可）"
          className="border rounded-lg px-3 py-2 text-sm w-full font-mono" rows={6} />
        <button
          onClick={() => post('/api/admin/care/policies',
            { action: 'create_draft', policy_kind: kind, version_label: label, body_text: body }, '已建立草稿')}
          className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-semibold">
          建立草稿
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-red-800 text-sm mb-1">載入失敗</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {loading && <div className="bg-white rounded-xl border p-8 text-center text-gray-500">載入中…</div>}

      {!loading && !error && (
        <div className="space-y-3">
          {KINDS.map(k => {
            const versions = rows.filter(r => r.policy_kind === k)
            return (
              <div key={k} className="bg-white rounded-xl border p-4">
                <p className="font-semibold text-gray-800 text-sm mb-2">{POLICY_KIND_LABELS[k]}</p>
                {versions.length === 0 ? (
                  <p className="text-sm text-gray-500">尚無版本</p>
                ) : versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-3 py-2 border-t first:border-0">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{v.version_label}</p>
                      <p className="text-xs text-gray-500">
                        {labelOf(POLICY_STATUS_LABELS, v.status)}
                        {!v.body_text && '・正文尚未填入'}
                        {v.published_at && `・${v.published_at.slice(0, 10)} 發布`}
                      </p>
                    </div>
                    {v.status === 'draft' && v.body_text && (
                      <button
                        onClick={() => post(`/api/admin/care/policies/${v.id}`, { action: 'publish' }, '已發布')}
                        className="text-sm border rounded-lg px-3 py-1.5 flex-shrink-0">發布</button>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
