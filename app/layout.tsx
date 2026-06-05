import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = 'https://healthec.vercel.app'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-gray-50 text-gray-800 antialiased">
        {children}
      </body>
    </html>
  )
}
