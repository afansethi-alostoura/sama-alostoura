import type { Metadata } from 'next'
import './globals.css'
import { RootLayoutWrapper } from '@/components/layout/root-layout-wrapper'

export const metadata: Metadata = {
  title: 'Sama Alostoura AI OS',
  description: 'AI Construction Operating System — Sama Alostoura Building Contracting LLC',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RootLayoutWrapper>{children}</RootLayoutWrapper>
      </body>
    </html>
  )
}
