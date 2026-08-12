'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface ArticleData {
  id?: number
  slug: string
  title: string
  excerpt: string
  cover_image_url: string
  content: string
  category_slug: string
  reading_minutes: number
  is_published: boolean
}

const CATEGORY_OPTIONS = [
  { value: '', label: '不指定' },
  { value: 'bone-joint', label: '🦴 骨骼關節' },
  { value: 'cardiovascular', label: '❤️ 心血管保健' },
  { value: 'digestive', label: '🫁 腸胃消化' },
  { value: 'sleep-relax', label: '😴 睡眠疲勞' },
  { value: 'eye-care', label: '👁️ 眼睛視力' },
  { value: 'immune', label: '🛡️ 免疫力' },
  { value: 'beauty-skin', label: '✨ 美容肌膚' },
  { value: 'weight-management', label: '⚖️ 體重管理' },
  { value: 'womens-health', label: '🌸 女性保健' },
  { value: 'mens-health', label: '💪 男性保健' },
  { value: 'children-growth', label: '🌱 兒童成長' },
  { value: 'senior-health', label: '🏆 銀髮保健' },
]

// 問題導向文章骨架：先分型 → 飲食 → 生活 → 營養素搭配 → 就醫提醒 → 自測 CTA
const PROBLEM_TEMPLATE = `## （用一個共同困擾開場，說明它其實分成好幾種）

## 第一步：先判斷你是哪一種

### A 型：（症狀描述）
- 特徵一
- 特徵二

### B 型：（症狀描述）
- 特徵一
- 特徵二

### C 型：（症狀描述）
- 特徵一
- 特徵二

## 第二步：飲食怎麼調
- 多吃什麼
- 少吃什麼

## 第三步：生活方式
- 作息 / 運動 / 習慣建議

## 第四步：營養素怎麼搭（依你的類型）

### A 型
- **主力成分**（作用）
- 搭配成分
- **時間**：（隨餐 / 空腹 / 睡前）
- **來源**：（劑型 / 挑選重點）

### B 型
- ...

## 這些情況，請先看醫生
- 危險徵兆一
- 危險徵兆二

> 不確定自己屬於哪一型？可以做一份 2 分鐘「健康自測」，系統會依你的狀況給出飲食、作息與營養素的搭配建議。`

export default function ArticleEditor({ initial }: { initial?: ArticleData }) {
  const router = useRouter()
  const isEdit = Boolean(initial?.id)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const [data, setData] = useState<ArticleData>({
    slug: initial?.slug || '',
    title: initial?.title || '',
    excerpt: initial?.excerpt || '',
    cover_image_url: initial?.cover_image_url || '',
    content: initial?.content || '',
    category_slug: initial?.category_slug || '',
    reading_minutes: initial?.reading_minutes || 5,
    is_published: initial?.is_published !== false,
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const update = <K extends keyof ArticleData>(k: K, v: ArticleData[K]) =>
    setData(d => ({ ...d, [k]: v }))

  const handleUpload = async (file: File, target: 'cover' | 'content') => {
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('bucket', 'articles')
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (d.success) {
        if (target === 'cover') {
          update('cover_image_url', d.url)
          toast.success('封面已上傳')
        } else {
          // Insert image markdown at cursor position
          const textarea = contentRef.current
          if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const before = data.content.slice(0, start)
            const after = data.content.slice(end)
            const imgMd = `\n\n![圖片說明](${d.url})\n\n`
            update('content', before + imgMd + after)
            setTimeout(() => {
              textarea.focus()
              const pos = start + imgMd.length
              textarea.setSelectionRange(pos, pos)
            }, 0)
          }
          toast.success('圖片已插入到內容中')
        }
      } else {
        toast.error(d.error || '上傳失敗')
      }
    } catch {
      toast.error('上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!data.title.trim() || !data.slug.trim() || !data.content.trim()) {
      toast.error('請填寫標題、網址識別碼和內容')
      return
    }
    setSaving(true)
    try {
      const url = isEdit ? `/api/admin/articles/${initial!.id}` : '/api/admin/articles'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const d = await res.json()
      if (d.success) {
        toast.success(isEdit ? '文章已更新' : '文章已建立')
        router.push('/admin/articles')
        router.refresh()
      } else {
        toast.error(d.error || '儲存失敗')
      }
    } catch {
      toast.error('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  // Auto-generate slug from title (only if empty/new)
  const onTitleBlur = () => {
    if (!data.slug.trim() && data.title.trim()) {
      const generated = data.title
        .trim()
        .toLowerCase()
        .replace(/[^\w一-龥\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80)
      update('slug', generated || `article-${Date.now()}`)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="card p-6 space-y-5">

        {/* Title */}
        <div>
          <label className="form-label">標題 <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="form-input"
            value={data.title}
            onChange={e => update('title', e.target.value)}
            onBlur={onTitleBlur}
            placeholder="例：我 45 歲那年，膝蓋開始抗議：聊聊關節保養這件事"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="form-label">
            網址識別碼 (slug) <span className="text-red-500">*</span>
            <span className="ml-2 text-gray-600 font-normal text-[13px]">英文小寫、數字、減號</span>
          </label>
          <input
            type="text"
            className="form-input font-mono"
            value={data.slug}
            onChange={e => update('slug', e.target.value)}
            placeholder="bone-joint-degeneration"
          />
          <p className="text-[13px] text-gray-600 mt-1">
            完整網址：healthec.vercel.app/health-articles/<strong>{data.slug || 'your-slug'}</strong>
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label className="form-label">摘要（用於文章列表 + LINE 分享預覽）</label>
          <textarea
            className="form-input"
            rows={3}
            value={data.excerpt}
            onChange={e => update('excerpt', e.target.value)}
            placeholder="一兩句話總結這篇文章，會在分享到 LINE 時顯示。"
          />
        </div>

        {/* Cover image */}
        <div>
          <label className="form-label">封面圖（建議比例 16:9 或 16:10）</label>
          {data.cover_image_url ? (
            <div className="space-y-2">
              <div className="aspect-[16/9] relative rounded-2xl overflow-hidden bg-gray-100 max-w-md">
                <Image src={data.cover_image_url} alt="封面" fill className="object-cover" sizes="500px" />
              </div>
              <div className="flex gap-2">
                <label className="btn-secondary py-2 px-4 text-sm cursor-pointer">
                  更換封面
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover')}
                    disabled={uploading}
                  />
                </label>
                <button
                  onClick={() => update('cover_image_url', '')}
                  className="text-red-600 hover:text-red-700 text-sm font-bold"
                >移除</button>
              </div>
            </div>
          ) : (
            <label className="border-2 border-dashed border-gray-300 hover:border-green-400 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer max-w-md transition-colors">
              <span className="text-3xl mb-2">📷</span>
              <span className="text-gray-600 font-bold text-sm">點擊上傳封面圖</span>
              <span className="text-gray-600 text-[13px] mt-1">JPG、PNG，最大 5MB</span>
              <input
                type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'cover')}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {/* Category + reading time + publish */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">分類</label>
            <select className="form-input" value={data.category_slug} onChange={e => update('category_slug', e.target.value)}>
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">預估閱讀（分鐘）</label>
            <input
              type="number" min={1} max={60} className="form-input"
              value={data.reading_minutes}
              onChange={e => update('reading_minutes', parseInt(e.target.value) || 5)}
            />
          </div>
          <div>
            <label className="form-label">發布狀態</label>
            <select className="form-input" value={data.is_published ? '1' : '0'} onChange={e => update('is_published', e.target.value === '1')}>
              <option value="1">✅ 已發布</option>
              <option value="0">⏸ 未發布（草稿）</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="form-label flex items-center justify-between flex-wrap gap-2">
            <span>內容 <span className="text-red-500">*</span></span>
            <label className="text-sm font-bold text-green-700 hover:text-green-800 cursor-pointer flex items-center gap-1">
              📷 在內容中插入圖片
              <input
                type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'content')}
                disabled={uploading}
              />
            </label>
          </label>
          <div className="mb-2 text-[13px] text-gray-500 bg-gray-50 rounded-lg p-3 leading-relaxed">
            <strong>格式說明：</strong>
            <code className="bg-white px-1 rounded">## 大標題</code>、
            <code className="bg-white px-1 rounded">### 小標題</code>、
            <code className="bg-white px-1 rounded">- 項目</code>、
            <code className="bg-white px-1 rounded">**粗體**</code>、
            <code className="bg-white px-1 rounded">{'> 警告區塊'}</code>、
            <code className="bg-white px-1 rounded">![圖說](網址)</code>。段落間用空行分隔。
          </div>
          <div className="mb-2 flex items-center justify-between gap-2 bg-green-50 border border-green-100 rounded-lg p-3">
            <p className="text-[13px] text-green-800 leading-relaxed">
              <strong>💡 問題導向寫法（建議）：</strong>先分型 → 飲食 → 生活 → 營養素搭配（主力/時間/來源）→ 就醫提醒 → 導到自測，讀者更容易對號入座並行動。
            </p>
            <button type="button"
              onClick={() => { if (!data.content.trim() || confirm('將以問題導向模板覆蓋目前內容？')) update('content', PROBLEM_TEMPLATE) }}
              className="flex-shrink-0 text-[13px] font-bold text-green-700 border-2 border-green-200 hover:bg-green-100 rounded-lg px-3 py-1.5 whitespace-nowrap">
              套用模板
            </button>
          </div>
          <textarea
            ref={contentRef}
            className="form-input font-mono text-sm leading-relaxed"
            rows={20}
            value={data.content}
            onChange={e => update('content', e.target.value)}
            placeholder={`## 一切都是從爬樓梯開始的\n\n我記得很清楚，是 45 歲那年的某一天...\n\n## 你也有這些感覺嗎\n\n- 早上起床第一步走路會痠痛\n- 下樓梯比上樓梯還痛\n\n> ⚠️ 已經有關節問題在治療的人...`}
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={() => router.push('/admin/articles')}
            className="btn-secondary"
          >取消</button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? '儲存中...' : (isEdit ? '儲存變更' : '建立文章')}
          </button>
        </div>
      </div>
    </div>
  )
}
