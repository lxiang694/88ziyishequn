'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import { TIME_SLOTS, labelOf, statusColor } from '@/lib/careMeta'

interface Props { id: number; onChanged: () => void }

const DOC_LABELS: Record<string, string> = {
  doc_id_front: '身分證正面',
  doc_id_back: '身分證反面',
  doc_bankbook: '存摺封面',
  doc_education: '學歷證明',
  doc_certificate: '相關證照',
}

export default function CompanionDetail({ id, onChanged }: Props) {
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    fetch(`/api/admin/care/companions/${id}`)
      .then(r => r.json())
      .then(res => { if (res.success) setD(res.data); else toast.error(res.error || '載入失敗') })
  }
  useEffect(load, [id])

  if (!d) return <div className="p-5 text-center text-gray-600">載入中…</div>

  const review = async (action: 'approve' | 'reject') => {
    let reject_reason = ''
    if (action === 'reject') {
      const r = prompt('請填寫退回原因（會顯示給陪診員）：')
      if (!r) return
      reject_reason = r
    } else {
      if (!confirm(`確定通過「${d.name}」的審核？通過後即可開始派工。`)) return
    }
    setBusy(true)
    const res = await fetch(`/api/admin/care/companions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reject_reason }),
    })
    const j = await res.json()
    setBusy(false)
    if (j.success) { toast.success(action === 'approve' ? '已通過審核' : '已退回'); load(); onChanged() }
    else toast.error(j.error || '操作失敗')
  }

  const Row = ({ l, v }: { l: string; v: any }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-600 text-sm flex-shrink-0">{l}</span>
      <span className="text-gray-900 text-[15px] font-medium text-right break-all">{v || '—'}</span>
    </div>
  )

  // 排班依日期分組
  const availByDate = new Map<string, string[]>()
  for (const a of d.availability || []) {
    if (!availByDate.has(a.date)) availByDate.set(a.date, [])
    availByDate.get(a.date)!.push(a.time_slot)
  }

  return (
    <div className="bg-gray-50/70 border-t border-gray-100 p-4 space-y-4">
      {/* 審核操作 */}
      {(d.status === 'pending' || d.profile_submitted_at) && (
        <div className={`rounded-xl p-4 border-2 ${d.status === 'active' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="font-bold text-gray-800 mb-1">
            {d.status === 'active' ? '✅ 已通過審核' : d.profile_submitted_at ? '⏳ 已送出審核，待處理' : '📝 資料尚未送出'}
          </p>
          {d.profile_submitted_at && (
            <p className="text-gray-700 text-sm">送出時間：{new Date(d.profile_submitted_at).toLocaleString('zh-TW')}</p>
          )}
          {d.reject_reason && <p className="text-red-700 text-sm mt-1">上次退回原因：{d.reject_reason}</p>}
          {d.status !== 'active' && d.profile_submitted_at && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => review('approve')} disabled={busy} className="btn-primary flex-1">通過審核</button>
              <button onClick={() => review('reject')} disabled={busy} className="btn-card-ghost flex-1">退回補正</button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 基本資料 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">基本資料</p>
          <Row l="姓名" v={d.name} />
          <Row l="手機" v={d.phone} />
          <Row l="身分證字號" v={d.id_number} />
          <Row l="生日" v={d.birthday} />
          <Row l="性別" v={d.gender === 'female' ? '女性' : d.gender === 'male' ? '男性' : ''} />
          <Row l="Email" v={d.email} />
          <Row l="地址" v={d.address} />
          <Row l="緊急聯絡人" v={d.emergency_contact ? `${d.emergency_contact}（${d.emergency_relation || '—'}）${d.emergency_phone || ''}` : ''} />
        </div>

        {/* 學經歷與帳戶 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">學經歷與匯款帳戶</p>
          <Row l="最高學歷" v={d.education} />
          <Row l="學校科系" v={d.school} />
          <Row l="證照" v={d.certifications} />
          <Row l="聘用型態" v={d.employment_type === 'fulltime' ? '全職' : '兼職'} />
          <Row l="可服務縣市" v={Array.isArray(d.service_areas) ? d.service_areas.join('、') : ''} />
          <Row l="銀行" v={d.bank_name ? `${d.bank_name} ${d.bank_branch || ''}` : ''} />
          <Row l="戶名" v={d.bank_account_name} />
          <Row l="帳號" v={d.bank_account} />
        </div>
      </div>

      {d.experience && (
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">相關經歷</p>
          <p className="text-gray-800 text-[15px] whitespace-pre-wrap">{d.experience}</p>
        </div>
      )}

      {/* 證件 */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-1">證件文件</p>
        <p className="text-gray-500 text-[13px] mb-3">🔒 私有儲存，連結 5 分鐘後失效；請勿轉傳或另存</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(DOC_LABELS).map(([k, label]) => {
            const url = d.docs?.[k]
            return (
              <div key={k} className="border border-gray-200 rounded-lg p-2">
                <p className="text-gray-700 text-[13px] font-semibold mb-1">{label}</p>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={label} className="w-full h-24 object-contain bg-gray-50 rounded" />
                    <span className="block text-green-700 text-[13px] font-bold mt-1">點擊放大 →</span>
                  </a>
                ) : (
                  <p className="text-gray-500 text-[13px] py-6 text-center">未上傳</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 排班 */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">
          未來可服務時段（{availByDate.size} 天）
        </p>
        {availByDate.size === 0 ? (
          <p className="text-gray-500 text-sm py-2">尚未設定班表</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...availByDate.entries()].map(([date, slots]) => (
              <span key={date} className="bg-green-50 border border-green-200 text-green-900 px-3 py-1.5 rounded-lg text-[13px] font-semibold">
                {date.slice(5)}｜{slots.map(s => labelOf(TIME_SLOTS, s).split('（')[0]).join('、')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 近期工單 */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <p className="font-bold text-gray-700 text-[13px] uppercase tracking-wider mb-2">近期工單</p>
        {(!d.bookings || d.bookings.length === 0) ? (
          <p className="text-gray-500 text-sm py-2">尚無工單</p>
        ) : (
          <div className="space-y-1.5">
            {d.bookings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-gray-800 text-[15px] font-medium">{b.service_date}・{b.hospital || '—'}</p>
                  <p className="text-gray-500 text-[13px]">{b.service_name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={'status-badge ' + statusColor(b.status)}>{b.status}</span>
                  {b.companion_fee != null && (
                    <p className="text-gray-700 text-[13px] mt-1">
                      {formatPrice(b.companion_fee)}{b.settled_at ? '・已結算' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
