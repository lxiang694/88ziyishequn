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
}

module.exports = nextConfig
