'use client'
import { useEffect } from 'react'

export default function FrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.error('[Front Error Boundary]', error)
    }
  }, [error])

  const clearLocalStateAndReload = () => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') || k === 'cart_items' || k.startsWith('isi_') || k.startsWith('psqi_') || k.startsWith('ess_')) {
          localStorage.removeItem(k)
        }
      })
    } catch {}
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="max-w-lg w-full text-center">
        <div className="text-5xl mb-4">😅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">頁面暫時無法顯示</h2>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          請嘗試以下方法：<br />
          1. 點下方按鈕清除瀏覽器狀態並重新載入<br />
          2. 強制重新整理（Ctrl+Shift+R）<br />
          3. 改用無痕視窗
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <button
            onClick={clearLocalStateAndReload}
            className="bg-green-700 hover:bg-green-800 text-white font-bold px-6 py-3 rounded-xl"
          >
            清除狀態並回首頁
          </button>
          <button
            onClick={() => reset()}
            className="border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-bold px-6 py-3 rounded-xl"
          >
            重試
          </button>
        </div>

        <details className="text-left bg-gray-50 rounded-xl p-4 text-[13px] text-gray-600">
          <summary className="cursor-pointer font-bold">技術詳情（提供給技術支援）</summary>
          <pre className="mt-2 whitespace-pre-wrap break-all">
            {error.message}
            {error.digest && `\n\nDigest: ${error.digest}`}
            {error.stack && `\n\n${error.stack.split('\n').slice(0, 5).join('\n')}`}
          </pre>
        </details>
      </div>
    </div>
  )
}
