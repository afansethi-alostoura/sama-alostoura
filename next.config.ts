import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options',         value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  // Referrer privacy
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  // Basic XSS protection for older browsers
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  // Permissions policy — disable unused browser features
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  // Strict transport security (HTTPS only, 1 year)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  images: { remotePatterns: [] },
  // Suppress url.parse() deprecation warning from intuit-oauth dependency
  serverExternalPackages: ['intuit-oauth'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
