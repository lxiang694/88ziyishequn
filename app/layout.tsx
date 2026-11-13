import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SITE_URL } from '@/lib/siteUrl'


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // 讓網頁鋪滿到 iPhone 螢幕最底（Safari 收起工具列後的那一段也算進來），
  // 底部固定列才貼得到最底；各列已用 env(safe-area-inset-bottom) 讓開 home 橫條
  viewportFit: 'cover',
  themeColor: '#15803d',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '健康優選 | 88自醫社群團購賣場',
    template: '%s | 健康優選',
  },
  description: '88自醫社群團購賣場嚴選台灣保健品，骨骼關節、心血管、腸胃、眼睛、睡眠、免疫力等各類保健品，7-11 門市取貨，免帳號直接下單。',
  keywords: ['保健品', '台灣保健品', '社群團購', '7-11取貨', '葉黃素', '魚油', '益生菌', '骨骼關節', '免疫力'],
  authors: [{ name: '健康優選' }],
  creator: '健康優選',
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: SITE_URL,
    siteName: '健康優選',
    title: '健康優選 | 88自醫社群團購賣場',
    description: '88自醫社群團購賣場嚴選保健品，7-11 門市取貨，免帳號直接下單。',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '健康優選 | 88自醫社群團購賣場',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '健康優選 | 88自醫社群團購賣場',
    description: '88自醫社群團購賣場嚴選保健品，7-11 門市取貨，免帳號直接下單。',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    google: '7OdHsJe9fLH_5PKaE_gBECO7bdKAN-pr7_QhtFSud7o',
  },
}

/**
 * 偵測手機系統的「字體大小」設定。
 *
 * Android（LINE、Chrome、三星瀏覽器）把字體調大時，網頁的字會跟著放大 1.5～2 倍，
 * 但畫面寬度不變 —— 為一般字體排的版面就會擠成一個字一行、按鈕疊在一起。
 * iPhone 預設不會放大網頁文字，所以用 iPhone 測不出來。
 *
 * 做法：放一段看不見的 10 個中文字（16px），量實際寬度。正常約 160px，
 * 字體放大時會跟著變寬。比例超過 1.2 就在 <html> 標上 data-big-text，
 * 樣式用 big: 變體換成容納大字的排法（tailwind.config.js）。
 * 量不到（例如舊瀏覽器出錯）就什麼都不做，維持原本的版面。
 */
const BIG_TEXT_PROBE = `(function(){try{var s=document.createElement('span');s.textContent='一二三四五六七八九十';s.style.cssText='position:fixed;left:0;top:0;visibility:hidden;white-space:nowrap;font-size:16px;line-height:1;pointer-events:none';document.body.appendChild(s);var r=s.getBoundingClientRect().width/160;document.body.removeChild(s);if(r>1.2)document.documentElement.setAttribute('data-big-text',r>1.6?'2':'1')}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-canvas text-gray-800 antialiased">
        {/* 偵測手機「字體大小」有沒有調大，要在畫面出來前就跑，避免先排一次再跳 */}
        <script dangerouslySetInnerHTML={{ __html: BIG_TEXT_PROBE }} />
        {children}
      </body>
    </html>
  )
}
