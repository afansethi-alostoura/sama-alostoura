'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Building2, Calculator, Wallet, ShoppingCart,
  FolderOpen, ClipboardList, Wrench, Users, UserPlus, Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'CEO Dashboard',  href: '/',             icon: LayoutDashboard, phase: 1 },
  { label: 'Projects',       href: '/projects',     icon: Building2,       phase: 1 },
  { label: 'Accounting',     href: '/accounting',   icon: Wallet,          phase: 1 },
  { label: 'Estimation',     href: '/estimation',   icon: Calculator,      phase: 3 },
  { label: 'Procurement',    href: '/procurement',  icon: ShoppingCart,    phase: 4 },
  { label: 'Documents',      href: '/documents',    icon: FolderOpen,      phase: 4 },
  { label: 'Site Reports',   href: '/reports',      icon: ClipboardList,   phase: 4 },
  { label: 'Leads',          href: '/leads',        icon: UserPlus,        phase: 4 },
  { label: 'Maintenance',    href: '/maintenance',  icon: Wrench,          phase: 5 },
  { label: 'HR & Admin',     href: '/hr',           icon: Users,           phase: 5 },
  { label: 'Settings',       href: '/settings',     icon: Settings,        phase: 1 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 flex flex-col z-40 shadow-xl">
      {/* Branding */}
      <div className="px-5 py-5 border-b border-slate-800">
        <h1 className="text-white font-bold text-lg">Sama Alostoura</h1>
        <p className="text-slate-400 text-xs mt-1">AI Construction OS</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon, phase }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          const isLive   = phase <= 1

          return (
            <Link
              key={href}
              href={isLive ? href : '#'}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                isActive
                  ? 'bg-brand-500 text-white font-medium'
                  : isLive
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 cursor-default'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {phase > 1 && (
                <span className="text-xs bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                  P{phase}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800 space-y-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Logout</span>
        </button>

        <div>
          <p className="text-slate-500 text-xs">Phase 1 of 5</p>
          <div className="mt-1.5 h-1 bg-slate-800 rounded-full">
            <div className="h-1 bg-brand-500 rounded-full w-[20%]" />
          </div>
          <p className="text-slate-600 text-xs mt-2">Dubai, UAE  •  2024</p>
        </div>
      </div>
    </aside>
  )
}
