import type { Metadata } from 'next'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'Login — Sama Alostoura AI OS',
  description: 'Login to Sama Alostoura AI Construction Operating System',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Clean login page - no sidebar, no navigation */}
        {children}
      </body>
    </html>
  )
}
