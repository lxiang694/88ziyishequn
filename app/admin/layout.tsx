'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'

interface AdminInfo { id: number; name: string; role_key: string; role_name: string; permissions: string[] }

const SEEN_KEY = 'audit_downloads_seen_at'

const NAV = [
  { href: '/admin/dashboard', label: '📊 儀表板', perms: [] },
  { href: '/admin/orders', label: '📦 訂單管理', perms: ['orders.view','orders.status','orders.status.ship','orders.edit','all'] },
  { href: '/admin/products', label: '🛍️ 商品管理', perms: ['products.all','all'] },
  { href: '/admin/categories', label: '🏷️ 健康分類', perms: ['products.all','categories.all','all'] },
  { href: '/admin/articles', label: '📚 健康知識', perms: ['products.all','all'] },
  // reports: super_admin + customer_service
  { href: '/admin/reports', label: '📈 銷售報表', perms: ['all', 'orders.view'] },
  { href: '/admin/funnel', label: '🔻 下單漏斗', perms: ['all', 'orders.view'] },
  { href: '/admin/customers', label: '🔁 復購分析', perms: ['all', 'orders.view'] },
  { href: '/admin/events', label: '📅 社群活動', perms: ['all', 'events.view'] },
  { href: '/admin/care', label: '🩺 陪診營運總覽', perms: ['all', 'care_operations.view', 'care_intake.manage', 'care_quote.manage', 'care_case.manage'] },
  { href: '/admin/care/intakes', label: '　└ 需求初評', perms: ['all', 'care_operations.view', 'care_intake.manage'] },
  { href: '/admin/care/cases', label: '　└ 陪診案件', perms: ['all', 'care_operations.view', 'care_case.manage'] },
  { href: '/admin/care/quotes', label: '　└ 報價管理', perms: ['all', 'care_operations.view', 'care_quote.manage'] },
  { href: '/admin/care/bookings', label: '　└ 陪診預約', perms: ['all', 'care.view'] },
  { href: '/admin/care/service-control', label: '　└ 服務控制台', perms: ['all', 'care_operations.view', 'care_record.review', 'care_summary.review', 'care_incident.manage'] },
  { href: '/admin/care/records', label: '　└ 服務紀錄審核', perms: ['all', 'care_operations.view', 'care_record.review'] },
  { href: '/admin/care/summaries', label: '　└ 家屬小結', perms: ['all', 'care_operations.view', 'care_summary.review'] },
  { href: '/admin/care/incidents', label: '　└ 異常事件', perms: ['all', 'care_operations.view', 'care_incident.manage'] },
  { href: '/admin/care/staff', label: '　└ 陪診員名冊', perms: ['all', 'care_staff.manage', 'care_schedule.manage', 'care_dispatch.manage'] },
  { href: '/admin/care/schedule', label: '　└ 班表與時段', perms: ['all', 'care_schedule.manage', 'care_dispatch.manage'] },
  { href: '/admin/care/time-off', label: '　└ 請假審核', perms: ['all', 'care_staff_time_off.review'] },
  { href: '/admin/care/dispatch', label: '　└ 人工媒合', perms: ['all', 'care_dispatch.manage'] },
  { href: '/admin/care/dispatch/proposals', label: '　　└ 兼職邀請', perms: ['all', 'care_dispatch.manage'] },
  { href: '/admin/care/settlements', label: '　└ 結算明細與批次', perms: ['all', 'care_settlement.manage'] },
  { href: '/admin/companions', label: '👥 陪診員管理', perms: ['all'] },
  { href: '/admin/settlement', label: '💰 陪診結算報表', perms: ['all'] },
  { href: '/admin/members', label: '👤 會員管理', perms: ['all'] },
  { href: '/admin/traffic', label: '📡 流量監控', perms: ['all'] },
  { href: '/admin/audit', label: '🛡️ 稽核日誌', perms: ['all'] },
  { href: '/admin/users', label: '👥 帳號管理', perms: ['all'] },
]

function hasAccess(perms: string[], required: string[]) {
  if (!required.length) return true
  return perms.includes('all') || required.some(p => perms.includes(p))
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [checked, setChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [downloadAlerts, setDownloadAlerts] = useState(0)
  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) { setChecked(true); return }
    fetch('/api/admin/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.success) setAdmin(d.data)
        else router.replace('/admin/login')
        setChecked(true)
      })
      .catch(() => { router.replace('/admin/login'); setChecked(true) })
  }, [pathname, isLoginPage, router])

  // 記錄每次頁面瀏覽（登入頁除外），供超級管理員稽核；用 ref 去重避免同頁重複記錄
  const loggedPathRef = useRef<string>('')
  useEffect(() => {
    if (isLoginPage || !admin) return
    if (loggedPathRef.current === pathname) return
    loggedPathRef.current = pathname
    fetch('/api/admin/audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'page_view', detail: pathname }),
    }).catch(() => {})
  }, [pathname, isLoginPage, admin])

  // 超級管理員：查詢自上次檢視後的資料下載筆數，顯示提示徽章
  const refreshAlerts = useCallback(() => {
    if (!admin?.permissions?.includes('all')) { setDownloadAlerts(0); return }
    const since = localStorage.getItem(SEEN_KEY) || ''
    const params = new URLSearchParams({ type: 'downloads_count' })
    if (since) params.set('since', since)
    fetch('/api/admin/audit?' + params).then(r => r.json()).then(d => {
      if (d.success) setDownloadAlerts(d.count || 0)
    }).catch(() => {})
  }, [admin])

  useEffect(() => { refreshAlerts() }, [refreshAlerts, pathname])
  useEffect(() => {
    const h = () => setDownloadAlerts(0)
    window.addEventListener('audit-seen', h)
    return () => window.removeEventListener('audit-seen', h)
  }, [])

  if (isLoginPage) return <>{children}<Toaster position="top-center" /></>
  if (!checked) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-gray-600 text-lg">載入中...</div>
    </div>
  )
  if (!admin) return null

  const visibleNav = NAV.filter(item => hasAccess(admin.permissions, item.perms))

  const handleLogout = async () => {
    await fetch('/api/admin/auth/me', { method: 'DELETE' })
    toast.success('已登出')
    router.push('/admin/login')
  }

  const roleLabel: Record<string, string> = {
    super_admin: '超級管理員',
    customer_service: '客服人員',
    shipper: '出貨人員',
    product_manager: '商品管理',
    event_staff: '社群活動人員',
    care_staff: '陪診客服',
  }

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-gray-900 text-white flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="p-5 border-b border-gray-700 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">健</div>
          <div>
            <p className="font-bold text-sm leading-tight">健康優選後台</p>
            <p className="text-gray-600 text-[13px] mt-0.5">管理系統</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${pathname.startsWith(item.href) ? 'bg-green-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              <span className="flex-1">{item.label}</span>
              {item.href === '/admin/audit' && downloadAlerts > 0 && (
                <span className="ml-2 min-w-5 h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-[13px] font-bold rounded-full">
                  {downloadAlerts > 99 ? '99+' : downloadAlerts}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <p className="text-white font-bold text-sm">{admin.name}</p>
          <p className="text-gray-600 text-[13px] mt-0.5 mb-3">{roleLabel[admin.role_key] || admin.role_key}</p>
          <button onClick={handleLogout} className="text-gray-600 hover:text-red-400 text-sm transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            登出
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-20 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100" aria-label="選單">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-gray-500 text-sm font-medium hidden sm:block">
            {visibleNav.find(n => pathname.startsWith(n.href))?.label?.replace(/^[^\s]+ /, '') || '後台'}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1.5 text-[13px] text-gray-600">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              {admin.name}
            </span>
            <Link href="/" target="_blank" className="text-sm text-green-700 hover:text-green-800 font-semibold hover:underline">
              前往前台 →
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontSize: '15px', fontWeight: '600' } }} />
    </div>
  )
}
