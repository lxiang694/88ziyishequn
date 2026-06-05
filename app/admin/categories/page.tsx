'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function CategoriesPage() {
  const [cats, setCats] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', slug: '', sort_order: 0, is_active: true })
  const [editing, setEditing] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCats = async () => {
    const res = await fetch('/api/admin/categories')
    const d = await res.json()
    if (d.success) setCats(d.data)
    setLoading(false)
  }
  useEffect(() => { fetchCats() }, [])

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast.error('名稱與識別碼為必填'); return }
    const url = editing ? `/api/admin/categories/${editing}` : '/api/admin/categories'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await res.json()
    if (d.success) { toast.success(editing ? '已更新' : '已新增'); fetchCats(); setForm({ name: '', slug: '', sort_order: 0, is_active: true }); setEditing(null) }
    else toast.error(d.error)
  }

  const handleEdit = (cat: any) => { setEditing(cat.id); setForm({ name: cat.name, slug: cat.slug, sort_order: cat.sort_order, is_active: cat.is_active }) }

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此分類？')) return
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.success) { toast.success('已刪除'); fetchCats() } else toast.error(d.error)
  }

  const autoSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">健康分類管理</h1>

      <div className="card p-5 mb-6">
        <h2 className="font-bold text-gray-800 mb-4">{editing ? '編輯分類' : '新增分類'}</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="form-label">分類名稱 *</label>
            <input className="form-input" placeholder="例：骨骼關節" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))} />
          </div>
          <div>
            <label className="form-label">識別碼 (slug) *</label>
            <input className="form-input" placeholder="bone-joint" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">排序</label>
            <input type="number" className="form-input" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-5 h-5 rounded accent-green-600" />
              <span className="font-medium text-gray-700">啟用分類</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-primary py-2 px-6 text-base">{editing ? '儲存修改' : '新增'}</button>
          {editing && <button onClick={() => { setEditing(null); setForm({ name: '', slug: '', sort_order: 0, is_active: true }) }} className="btn-secondary py-2 px-6 text-base">取消</button>}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="py-12 text-center text-gray-400">載入中...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              {['排序','名稱','識別碼','狀態','操作'].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {cats.map(cat => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{cat.sort_order}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{cat.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{cat.is_active ? '啟用' : '停用'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => handleEdit(cat)} className="text-green-700 font-semibold hover:underline">編輯</button>
                      <button onClick={() => handleDelete(cat.id)} className="text-red-500 font-semibold hover:underline">刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
