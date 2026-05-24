import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'

export const metadata: Metadata = {
  title: 'Sama Alostoura AI OS',
  description: 'AI Construction Operating System — Sama Alostoura Building Contracting LLC',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
