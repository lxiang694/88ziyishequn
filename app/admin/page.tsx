'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { hasCarePermission, ALL_CARE_PERMISSIONS } from '@/lib/care/domain'

interface AdminInfo { name: string; role_name: string; permissions: string[] }

const RETAIL_PERMS = ['orders.view', 'orders.status', 'orders.status.ship', 'orders.edit', 'products.all', 'categories.all', 'events.view']

/**
 * 總後台工作區選擇。
 * 零售營運與陪診營運共用登入與 RBAC，但不混合客戶資料或功能選單。
 */
export default function AdminWorkspacePage() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    fetch('/api/admin/auth/me').then(r => r.json())
      .then(d => { if (d.success) setAdmin(d.data); setChecked(true) })
      .catch(() => setChecked(true))
  }, [])

  const perms = admin?.permissions || []
  const canCare = hasCarePermission(perms, ALL_CARE_PERMISSIONS)
  const canRetail = perms.includes('all') || RETAIL_PERMS.some(p => perms.includes(p))

  if (!checked) return <div className="max-w-3xl mx-auto card p-10 text-center text-gray-600">載入中…</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">工作區</h1>
        <p className="text-gray-600 text-[15px] mt-1">
          {admin ? `${admin.name}・${admin.role_name}` : '請選擇要進入的工作區'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 零售營運 */}
        <div className={`card p-6 ${canRetail ? '' : 'opacity-60'}`}>
          <p className="text-3xl mb-2" aria-hidden="true">🛍️</p>
          <h2 className="font-bold text-gray-900 text-lg mb-1">零售營運</h2>
          <p className="text-gray-600 text-[15px] leading-relaxed mb-4">
            訂單、商品、健康知識、銷售報表與社群活動。
          </p>
          {canRetail ? (
            <Link href="/admin/dashboard" className="btn-primary inline-flex">進入零售營運</Link>
          ) : (
            <p className="text-gray-600 text-[13px]">您的帳號沒有零售營運權限。</p>
          )}
        </div>

        {/* 陪診營運 */}
        <div className={`card p-6 ${canCare ? '' : 'opacity-60'}`}>
          <p className="text-3xl mb-2" aria-hidden="true">🩺</p>
          <h2 className="font-bold text-gray-900 text-lg mb-1">陪診營運</h2>
          <p className="text-gray-600 text-[15px] leading-relaxed mb-4">
            需求初評、案件流程與報價管理。與零售客戶資料分開。
          </p>
          {canCare ? (
            <Link href="/admin/care" className="btn-primary inline-flex">進入陪診營運</Link>
          ) : (
            <p className="text-gray-600 text-[13px]">
              您的帳號沒有陪診營運權限。需要時請聯絡超級管理員開通。
            </p>
          )}
        </div>
      </div>

      <p className="text-gray-600 text-[13px] leading-relaxed mt-6">
        兩個工作區共用同一組登入與權限系統；能進入後台不代表能查看陪診個案，
        陪診資料需要另外的業務權限。
      </p>
    </div>
  )
}
