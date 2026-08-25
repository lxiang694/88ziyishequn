/** @type {import('next').NextConfig} */
const nextConfig = {
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

  // 舊陪診路由 → 新的陪診品牌前台。
  // 目的地皆為站內固定路徑，不吃任何來源 query，因此不可能被導向外部網址；
  // 來源與目的地不重疊，也不會產生循環。
  async redirects() {
    return [
      { source: '/services/medical-companion', destination: '/care', permanent: true },
      { source: '/request/medical-companion', destination: '/care/assessment', permanent: true },
    ]
  },
}

module.exports = nextConfig
