'use client'
export default function LineFloatButton() {
  return (
    <a
      href="https://line.me/ti/p/yJdrshwviU"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="LINE 聯絡客服"
      className="fixed z-45 flex items-center gap-2 bg-[#00B900] hover:bg-[#00a000] text-white rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
      style={{ bottom: '84px', right: '16px', padding: '10px 16px', zIndex: 45 }}
    >
      <svg width="24" height="24" viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 4C13 4 4 11.8 4 21.4c0 8.3 7.4 15.3 17.4 16.7.7.1 1.6.5 1.8 1 .2.5.1 1.3 0 1.8l-.3 1.8c-.1.5-.4 2 1.8 1.1 2.2-.9 11.8-7 16.1-12C43.8 29 44 25.3 44 21.4 44 11.8 35 4 24 4z"/>
      </svg>
      <span className="font-bold text-sm">客服</span>
    </a>
  )
}
