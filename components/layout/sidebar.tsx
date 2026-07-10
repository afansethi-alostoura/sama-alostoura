'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Building2, Calculator, Wallet, ShoppingCart,
  FolderOpen, ClipboardList, Wrench, Users, UserPlus, Settings,
  LogOut, ChevronLeft, ChevronRight, Bot, X, PieChart, Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'CEO Dashboard',  href: '/',             icon: LayoutDashboard },
  { label: 'Projects',       href: '/projects',     icon: Building2       },
  { label: 'Accounting',          href: '/accounting',          icon: Wallet    },
  { label: 'Company Financials',  href: '/company-financials',  icon: PieChart  },
  { label: 'Reconciliation',      href: '/reconciliation',      icon: Scale     },
  { label: 'Estimation',     href: '/estimation',   icon: Calculator      },
  { label: 'Procurement',    href: '/procurement',  icon: ShoppingCart    },
  { label: 'Documents',      href: '/documents',    icon: FolderOpen      },
  { label: 'Site Reports',   href: '/reports',      icon: ClipboardList   },
  { label: 'Leads',          href: '/leads',        icon: UserPlus        },
  { label: 'Maintenance',    href: '/maintenance',  icon: Wrench          },
  { label: 'HR & Admin',     href: '/hr',           icon: Users           },
  { label: 'Settings',       href: '/settings',     icon: Settings        },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch {}
  }

  const navContent = (isMobile = false) => (
    <aside
      className={cn(
        'flex flex-col h-full bg-[#1a1f2e] overflow-hidden',
        !isMobile && 'transition-[width] duration-300 ease-in-out',
        !isMobile && (collapsed ? 'w-[68px]' : 'w-64'),
        isMobile && 'w-72'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-white/10 flex-shrink-0 h-[60px]',
        (!isMobile && collapsed) ? 'justify-center px-4' : 'px-5',
        isMobile && 'justify-between'
      )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm leading-tight whitespace-nowrap">Sama Alostoura</p>
              <p className="text-slate-400 text-xs whitespace-nowrap">AI Construction OS</p>
            </div>
          )}
        </div>
        {isMobile && (
          <button onClick={onMobileClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={isMobile ? onMobileClose : undefined}
              title={(!isMobile && collapsed) ? label : undefined}
              className={cn(
                'flex items-center rounded-lg transition-all duration-150 group relative',
                (!isMobile && collapsed) ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5 gap-3',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className={cn(
                'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
              )} />
              {(!collapsed || isMobile) && (
                <span className="text-sm font-medium whitespace-nowrap">{label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 p-2 flex-shrink-0 space-y-1">
        {(!collapsed || isMobile) && (
          <div className="px-3 py-2">
            <p className="text-white text-sm font-medium truncate">Admin</p>
            <p className="text-slate-500 text-xs truncate">sama@construction.ae</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={(!isMobile && collapsed) ? 'Logout' : undefined}
          className={cn(
            'flex items-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full',
            (!isMobile && collapsed) ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-[72px] w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-md hover:bg-slate-50 transition-colors z-50"
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3 text-slate-500" />
            : <ChevronLeft  className="w-3 h-3 text-slate-500" />
          }
        </button>
      )}
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block fixed left-0 top-0 h-screen z-40">
        {navContent(false)}
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="relative h-full">
            {navContent(true)}
          </div>
        </div>
      )}
    </>
  )
}
