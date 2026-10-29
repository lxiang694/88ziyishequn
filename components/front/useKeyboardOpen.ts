'use client'
import { useEffect, useState } from 'react'

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image', 'hidden'])

function isTyping(el: Element | null): boolean {
  if (!el) return false
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type)
  return (el as HTMLElement).isContentEditable === true
}

/**
 * 手機是否正在打字（鍵盤開著）。底部固定的下單按鈕、選單、LINE 鈕在打字時要藏起來，免得蓋住輸入框。
 *
 * 不能只靠 focusin／focusout：輸入框所在的畫面直接關掉時（例如在選門市的彈窗打完字、
 * 選好門市彈窗就消失），瀏覽器不會送 focusout，狀態會卡在「打字中」，
 * 結帳頁的「確認下單」就一直藏著、客人送不出訂單。
 * 所以每次點擊、捲動、鍵盤收起時，以及每秒一次，都直接看「現在焦點在哪」。
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setOpen(isTyping(document.activeElement)), 0)
    }
    const doc: [string, EventListener][] = [['focusin', sync], ['focusout', sync], ['pointerdown', sync], ['touchend', sync]]
    doc.forEach(([e, f]) => document.addEventListener(e, f, { passive: true }))
    window.addEventListener('scroll', sync, { passive: true })
    window.visualViewport?.addEventListener('resize', sync)
    const poll = setInterval(sync, 1000)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      doc.forEach(([e, f]) => document.removeEventListener(e, f))
      window.removeEventListener('scroll', sync)
      window.visualViewport?.removeEventListener('resize', sync)
    }
  }, [])
  return open
}
