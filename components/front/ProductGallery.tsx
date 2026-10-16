'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

/**
 * 商品主圖：手機上左右滑動切換（CSS scroll-snap，原生手感、不用套件），
 * 下方小圓點＋右上「2 / 5」告訴客人還有幾張；縮圖點了會滑到那一張；
 * 桌機滑鼠沒辦法滑，另外放左右箭頭。
 */
export default function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const list = Array.from(new Set(images.filter(Boolean)))
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  // 依捲動位置算出目前第幾張（滑動、點縮圖、按箭頭都會觸發）
  useEffect(() => {
    const el = track.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const go = (i: number) => {
    const el = track.current
    if (!el) return
    const n = (i + list.length) % list.length
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  if (list.length === 0) {
    return <div className="mb-3 flex aspect-square items-center justify-center rounded-2xl bg-white text-7xl text-gray-200 shadow-sm">💊</div>
  }

  return (
    <div>
      <div className="group relative mb-3 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div ref={track} aria-roledescription="carousel" aria-label="商品圖片"
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((src, i) => (
            <div key={src} className="relative h-full w-full flex-shrink-0 snap-center snap-always" role="group" aria-label={`第 ${i + 1} 張，共 ${list.length} 張`}>
              <Image src={src} alt={i === 0 ? alt : `${alt}（第 ${i + 1} 張）`} fill className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw" priority={i === 0} loading={i === 0 ? undefined : 'lazy'} />
            </div>
          ))}
        </div>

        {list.length > 1 && (
          <>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[13px] font-bold text-white tabular-nums">
              {index + 1} / {list.length}
            </span>
            {/* 小圓點：目前這張拉長成膠囊 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
              {list.map((_, i) => (
                <span key={i} className={`h-2 rounded-full shadow-sm transition-all ${i === index ? 'w-5 bg-green-600' : 'w-2 bg-white/90 ring-1 ring-black/10'}`} />
              ))}
            </div>
            {/* 桌機左右箭頭（手機直接滑） */}
            <button type="button" aria-label="上一張" onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl text-gray-700 shadow-md transition-opacity hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100">‹</button>
            <button type="button" aria-label="下一張" onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl text-gray-700 shadow-md transition-opacity hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100">›</button>
          </>
        )}
      </div>

      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((src, i) => (
            <button key={src} type="button" onClick={() => go(i)} aria-label={`看第 ${i + 1} 張`} aria-current={i === index}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-colors
                ${i === index ? 'border-green-600' : 'border-gray-200 opacity-70 hover:border-green-300'}`}>
              <Image src={src} alt="" width={64} height={64} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
