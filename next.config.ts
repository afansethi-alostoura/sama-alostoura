import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: { remotePatterns: [] },
  // Suppress url.parse() deprecation warning from intuit-oauth dependency
  serverExternalPackages: ['intuit-oauth'],
}

export default nextConfig
