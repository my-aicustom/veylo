/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/app';
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  basePath,
  headers: async () => [{
    source: '/(.*)',
    headers: [
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self)' }
    ]
  }]
};
export default nextConfig;
