'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Bell, Search, ChevronDown, Menu } from 'lucide-react'

export function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoginPage) return <>{children}</>

  const sidebarWidth = collapsed ? 68 : 256

  return (
    // CSS variable drives both header left and main margin on md+
    <div
      className="flex min-h-screen bg-slate-50"
      style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Header: full-width on mobile, offset by sidebar on md+ */}
      <header className="fixed top-0 right-0 left-0 md:left-[var(--sidebar-w)] h-[60px] bg-white border-b border-slate-100 z-30 flex items-center px-4 gap-3 transition-[left] duration-300 ease-in-out">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects, clients..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
          <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">SA</span>
            </div>
            <span className="hidden sm:inline text-sm font-medium text-slate-700">Admin</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main: no left margin on mobile, sidebar-width margin on md+ */}
      <main className="flex-1 min-h-screen pt-[60px] overflow-x-hidden ml-0 md:ml-[var(--sidebar-w)] transition-[margin-left] duration-300 ease-in-out">
        {children}
      </main>
    </div>
  )
}
