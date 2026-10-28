import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RootLayoutWrapper } from '@/components/layout/root-layout-wrapper'

export const metadata: Metadata = {
  title: 'Sama Alostoura AI OS',
  description: 'AI Construction Operating System — Sama Alostoura Building Contracting LLC',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sama OS',
  },
  icons: {
    apple: '/logo.png',
    icon:  '/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
          }
        `}} />
      </head>
      <body>
        <RootLayoutWrapper>{children}</RootLayoutWrapper>
      </body>
    </html>
  )
}
