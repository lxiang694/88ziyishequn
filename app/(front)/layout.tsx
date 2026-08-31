import type { ReactNode } from 'react'
import FrontShell from '@/components/front/FrontShell'
import TrafficTracker from '@/components/front/TrafficTracker'
import PresalePopup from '@/components/front/PresalePopup'

/**
 * ⚠️ 這個 layout 刻意不做任何資料查詢。
 *
 * 它包住整個前台，所以每一個靜態頁在 build 時都會執行一次裡面的程式碼。
 * 之前為了給彈窗一張封面圖，在這裡查了一次 Supabase，結果 160 個頁面
 * 就查了 160 次，build 從 50 秒變成好幾分鐘。
 *
 * 彈窗需要的圖改由元件自己在瀏覽器端抓，而且只在真的要顯示時才抓 ——
 * 大多數訪客根本不會觸發，成本是零。
 */
export default function FrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TrafficTracker />
      <FrontShell>{children}</FrontShell>
      <PresalePopup />
    </>
  )
}
