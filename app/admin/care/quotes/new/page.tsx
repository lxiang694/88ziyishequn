'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import CareQuoteForm, { type QuoteFormValue } from '@/components/admin/CareQuoteForm'

export default function NewCareQuotePage() {
  const router = useRouter()
  const [caseId, setCaseId] = useState<number | null>(null)

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('case')
    const n = Number(raw)
    setCaseId(Number.isInteger(n) && n > 0 ? n : null)
  }, [])

  const submit = async (v: QuoteFormValue) => {
    if (!caseId) return
    const res = await fetch('/api/admin/care/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ care_case_id: caseId, ...v }),
    })
    const d = await res.json()
    if (!d.success) return toast.error(d.error || '建立失敗')
    toast.success('已建立報價草稿')
    router.push(`/admin/care/quotes/${d.data.quote_id}`)
  }

  if (caseId === null) {
    return (
      <div className="max-w-3xl mx-auto card p-8 text-center">
        <p className="text-gray-800 font-bold text-lg mb-2">缺少案件</p>
        <p className="text-gray-700 text-[15px]">請從案件詳情頁點「建立報價草稿」進入。</p>
        <Link href="/admin/care/cases" className="btn-secondary mt-4 inline-flex">回案件清單</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href={`/admin/care/cases/${caseId}`} className="text-gray-600 text-sm inline-flex min-h-[48px] items-center">← 回案件</Link>
      <h1 className="text-xl font-bold text-gray-800 mb-4">建立報價草稿</h1>
      <div className="card p-5">
        <CareQuoteForm submitLabel="建立草稿" onSubmit={submit} />
      </div>
    </div>
  )
}
