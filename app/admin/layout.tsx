'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'

interface AdminInfo { id: number; name: string; role_key: string; role_name: string; permissions: string[] }

const NAV = [
  { href: '/admin/dashboard', label: '📊 儀表板', perms: [] },
  { href: '/admin/orders', label: '📦 訂單管理', perms: ['orders.view','orders.status','orders.status.ship','orders.edit','all'] },
  { href: '/admin/products', label: '🛍️ 商品管理', perms: ['products.all','all'] },
  { href: '/admin/categories', label: '🏷️ 健康分類', perms: ['products.all','categories.all','all'] },
  { href: '/admin/articles', label: '📚 健康知識', perms: ['products.all','all'] },
  // reports: super_admin + customer_service
  { href: '/admin/reports', label: '📈 銷售報表', perms: ['all', 'orders.view'] },
  { href: '/admin/customers', label: '🔁 復購分析', perms: ['all', 'orders.view'] },
  { href: '/admin/events', label: '📅 社群活動', perms: ['all'] },
  { href: '/admin/members', label: '👤 會員管理', perms: ['all'] },
  { href: '/admin/traffic', label: '📡 流量監控', perms: ['all'] },
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

  if (isLoginPage) return <>{children}<Toaster position="top-center" /></>
  if (!checked) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-gray-400 text-lg">載入中...</div>
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
  }

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-gray-900 text-white flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="p-5 border-b border-gray-700 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">健</div>
          <div>
            <p className="font-bold text-sm leading-tight">健康優選後台</p>
            <p className="text-gray-400 text-xs mt-0.5">管理系統</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${pathname.startsWith(item.href) ? 'bg-green-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <p className="text-white font-bold text-sm">{admin.name}</p>
          <p className="text-gray-400 text-xs mt-0.5 mb-3">{roleLabel[admin.role_key] || admin.role_key}</p>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 text-sm transition-colors flex items-center gap-1.5">
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
            <span className="hidden md:flex items-center gap-1.5 text-xs text-gray-400">
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
