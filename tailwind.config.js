/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#2d7a3a',
          light: '#e8f5e9',
          dark: '#1a4a24',
        },

        // ── 前台底色 ──────────────────────────────────────
        // 這四個色本來只活在首屏（HomeHero）裡，頁面其餘部分卻是
        // Tailwind 預設的冷灰 bg-gray-50（#f9fafb）。結果首屏像一座
        // 孤島，往下捲就換了一種溫度。
        //
        // 賣的是紫蘇油、茶飲、膏方、草本這類東西，暖調的米色比冷灰
        // 合適；而且實際並排比過，白卡片在 #f7f6ee 上的浮起程度明顯
        // 比在 #f9fafb 上好（亮度差 1.10 對 1.04），層次讀得出來。
        canvas: '#f7f6ee',   // 頁面底色
        paper:  '#faf9f4',   // 卡片內的圖片底，比 canvas 再亮一點
        sage:   '#e9edde',   // 次級區塊：賣場左側分類欄、區塊帶
        line:   '#e1e5d9',   // 分隔線與卡片外框
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"Microsoft JhengHei"', '"PingFang TC"', 'sans-serif'],
      },
      screens: {
        'xs': '380px',
      },
    },
  },
  plugins: [],
}
