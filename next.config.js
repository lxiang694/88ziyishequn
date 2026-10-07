/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/admin/myship/batches': ['./assets/myship/order-import-v1.4.xlsm'],
      '/api/admin/myship/batches/*': ['./assets/myship/order-import-v1.4.xlsm'],
    },
  },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    // unoptimized: bypass Vercel image-optimization quota (Hobby plan limited to 1000/month).
    // Images load directly from source CDNs (Supabase Storage, Unsplash) — they have their own CDN.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
    ],
  },
  // bcryptjs needs to be excluded from client bundle
  serverExternalPackages: ['bcryptjs'],

  // 陪診業務已移除。舊網址（搜尋引擎、分享出去的連結）導回首頁，不留 404。
  // 用暫時轉址（307）：之後若重新開辦，瀏覽器不會記住這個轉址。
  // 目的地是站內固定路徑，不吃來源 query，不可能被導向外部網址。
  async redirects() {
    return [
      { source: '/care', destination: '/', permanent: false },
      { source: '/care/:path*', destination: '/', permanent: false },
      { source: '/companion', destination: '/', permanent: false },
      { source: '/companion/:path*', destination: '/', permanent: false },
      { source: '/services/medical-companion', destination: '/', permanent: false },
      { source: '/request/medical-companion', destination: '/', permanent: false },
    ]
  },
}

module.exports = nextConfig
