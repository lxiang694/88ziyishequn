'use client'
import { useEffect, useState } from 'react'

/**
 * 商品頁的分頁籤（商品介紹／成分規格／評價），黏在網站表頭下面。
 * 跟台灣購物網站一樣：點了捲到那一段，捲動時目前看到的那一段會亮起來。
 */
export interface TabItem { id: string; label: string; badge?: string }

export default function SectionTabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(items[0]?.id)
  const ids = items.map(i => i.id).join(',')

  useEffect(() => {
    const sections = ids.split(',').map(id => document.getElementById(id)).filter((n): n is HTMLElement => !!n)
    if (!sections.length) return
    // 表頭＋分頁籤大約 130px；區塊頂端越過這條線就算「正在看這段」
    const onScroll = () => {
      let current = sections[0].id
      for (const s of sections) if (s.getBoundingClientRect().top <= 140) current = s.id
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ids])

  const go = (id: string) => {
    const node = document.getElementById(id)
    if (!node) return
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 124, behavior: 'smooth' })
  }

  return (
    <nav aria-label="商品資訊" className="sticky top-16 z-20 -mx-4 mb-4 border-b border-gray-200 bg-white sm:top-20 md:mx-0 md:rounded-t-2xl">
      <div className="flex">
        {items.map(item => {
          const on = active === item.id
          return (
            <button key={item.id} type="button" onClick={() => go(item.id)} aria-current={on ? 'true' : undefined}
              className={`relative flex-1 py-3.5 text-[15px] font-bold transition-colors ${on ? 'text-green-700' : 'text-gray-500 hover:text-gray-800'}`}>
              {item.label}
              {item.badge && <span className="ml-1 text-[13px] font-semibold">{item.badge}</span>}
              {on && <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-full bg-green-600" aria-hidden />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
