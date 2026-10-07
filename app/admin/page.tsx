import { redirect } from 'next/navigation'

// 原本是「零售營運／陪診營運」工作區選擇頁。陪診業務移除後只剩零售，
// 直接進儀表板；保留這個路由，登入後導到 /admin 的地方才不會落空。
export default function AdminIndexPage() {
  redirect('/admin/dashboard')
}
