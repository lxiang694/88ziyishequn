'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PERMISSION_CATALOG, ALL_PERMISSION } from '@/lib/permissions'

const blankForm = { name: '', account: '', password: '', role_id: '', is_active: true }

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [form, setForm] = useState(blankForm)
  const [perms, setPerms] = useState<string[]>([])
  const [isAll, setIsAll] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    const [uRes, rRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/roles')])
    const [u, r] = await Promise.all([uRes.json(), rRes.json()])
    if (u.success) setUsers(u.data)
    if (r.success) setRoles(r.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  const resetForm = () => { setForm(blankForm); setPerms([]); setIsAll(false); setEditing(null) }

  // 選擇角色時，用該角色的預設權限預填勾選（方便快速套用）
  const onRoleChange = (roleId: string) => {
    setForm(f => ({ ...f, role_id: roleId }))
    const role = roles.find(r => String(r.id) === roleId)
    const rolePerms: string[] = role?.permissions_json || []
    if (rolePerms.includes(ALL_PERMISSION)) { setIsAll(true); setPerms([]) }
    else { setIsAll(false); setPerms(rolePerms.filter((p: string) => p !== ALL_PERMISSION)) }
  }

  const togglePerm = (key: string) => {
    setPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }

  const handleSave = async () => {
    if (!form.name || !form.account || !form.role_id) { toast.error('姓名、帳號、角色為必填'); return }
    if (!editing && !form.password) { toast.error('新增帳號時密碼為必填'); return }
    const permissions = isAll ? [ALL_PERMISSION] : perms
    if (permissions.length === 0) { toast.error('請至少勾選一項權限'); return }
    const body: any = { name: form.name, account: form.account, role_id: parseInt(form.role_id), is_active: form.is_active, permissions }
    if (form.password) body.password = form.password
    const res = await fetch(editing ? `/api/admin/users/${editing}` : '/api/admin/users', {
      method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    const d = await res.json()
    if (d.success) { toast.success(editing ? '已更新' : '帳號已新增'); fetchAll(); resetForm() }
    else toast.error(d.error)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此帳號？')) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { toast.success('已刪除'); fetchAll() } else toast.error(d.error)
  }

  const startEdit = (u: any) => {
    setEditing(u.id)
    setForm({ name: u.name, account: u.account, password: '', role_id: String(u.role_id), is_active: u.is_active })
    const stored: string[] = Array.isArray(u.permissions_json) ? u.permissions_json : []
    if (stored.includes(ALL_PERMISSION)) { setIsAll(true); setPerms([]) }
    else if (stored.length > 0) { setIsAll(false); setPerms(stored) }
    else {
      // 舊帳號未設定自訂權限 → 帶入角色預設
      const role = roles.find(r => String(r.id) === String(u.role_id))
      const rolePerms: string[] = role?.permissions_json || []
      if (rolePerms.includes(ALL_PERMISSION)) { setIsAll(true); setPerms([]) }
      else { setIsAll(false); setPerms(rolePerms.filter((p: string) => p !== ALL_PERMISSION)) }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const permLabel = (u: any): string => {
    const stored: string[] = Array.isArray(u.permissions_json) ? u.permissions_json : []
    if (stored.includes(ALL_PERMISSION)) return '全部權限'
    if (stored.length > 0) return `${stored.length} 項權限`
    return u.admin_roles?.role_name || '依角色'
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">後台帳號管理</h1>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-800 mb-4">{editing ? '編輯帳號' : '新增後台帳號'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div><label className="form-label">姓名 *</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="form-label">帳號 *</label><input className="form-input" value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))} /></div>
          <div><label className="form-label">{editing ? '新密碼（留空不修改）' : '密碼 *'}</label><input type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div>
            <label className="form-label">角色 *</label>
            <select className="form-input" value={form.role_id} onChange={e => onRoleChange(e.target.value)}>
              <option value="">請選擇角色</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
          </div>
        </div>

        {/* 權限設定 */}
        <div className="border-2 border-gray-100 rounded-xl p-4 mb-4">
          <p className="font-bold text-gray-700 text-sm mb-3">權限設定 <span className="text-gray-400 font-normal">（可依此帳號自由勾選，會覆蓋角色預設）</span></p>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={isAll} onChange={e => { setIsAll(e.target.checked); if (e.target.checked) setPerms([]) }} className="w-4 h-4 accent-green-600" />
            <span className="font-bold text-green-700 text-sm">超級管理員（擁有全部權限，並可查看稽核日誌）</span>
          </label>
          {!isAll && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERMISSION_CATALOG.map(p => (
                <label key={p.key} className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input type="checkbox" checked={perms.includes(p.key)} onChange={() => togglePerm(p.key)} className="w-4 h-4 accent-green-600 mt-0.5" />
                  <span className="text-sm text-gray-700 leading-snug">
                    {p.label}
                    {p.hint && <span className="block text-xs text-gray-400">{p.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <input type="checkbox" id="uactive" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-5 h-5 accent-green-600" />
          <label htmlFor="uactive" className="font-medium text-gray-700 cursor-pointer">啟用帳號</label>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-primary py-2 px-6 text-base">{editing ? '儲存修改' : '新增帳號'}</button>
          {editing && <button onClick={resetForm} className="btn-secondary py-2 px-6 text-base">取消</button>}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="py-12 text-center text-gray-400">載入中...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['姓名','帳號','角色','權限','狀態','操作'].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono">{u.account}</td>
                    <td className="px-4 py-3 text-gray-600">{u.admin_roles?.role_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{permLabel(u)}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{u.is_active ? '啟用' : '停用'}</span></td>
                    <td className="px-4 py-3 flex gap-3">
                      <button onClick={() => startEdit(u)} className="text-green-700 font-semibold hover:underline">編輯</button>
                      <button onClick={() => handleDelete(u.id)} className="text-red-500 font-semibold hover:underline">刪除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
