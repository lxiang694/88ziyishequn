'use client'
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Top-level client error boundary so a single component crash doesn't blank the whole site.
 */
export default class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    if (typeof window !== 'undefined') {
      console.error('[ClientErrorBoundary]', error, info)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="text-5xl mb-4">😅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">頁面暫時無法顯示</h2>
            <p className="text-gray-500 text-sm mb-6">
              請嘗試以下方法：<br/>
              1. 強制重新整理（Ctrl+Shift+R）<br/>
              2. 清除瀏覽器快取後重新載入<br/>
              3. 改用無痕視窗
            </p>
            <button
              onClick={() => {
                try {
                  // Clear potentially corrupt auth/cart state
                  Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('sb-') || k === 'cart_items') localStorage.removeItem(k)
                  })
                } catch {}
                window.location.href = '/'
              }}
              className="bg-green-700 hover:bg-green-800 text-white font-bold px-6 py-3 rounded-xl"
            >
              清除狀態並回首頁
            </button>
            {this.state.error?.message && (
              <details className="mt-6 text-xs text-gray-400">
                <summary className="cursor-pointer">技術詳情</summary>
                <pre className="text-left mt-2 p-2 bg-gray-50 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
