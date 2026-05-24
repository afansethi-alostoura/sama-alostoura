import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function progressBarColor(pct: number): string {
  if (pct >= 85) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-brand-500'
  if (pct >= 25) return 'bg-blue-500'
  return 'bg-slate-400'
}

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active:      'bg-emerald-100 text-emerald-800 ring-emerald-200',
    on_hold:     'bg-amber-100 text-amber-800 ring-amber-200',
    completed:   'bg-blue-100 text-blue-800 ring-blue-200',
    cancelled:   'bg-red-100 text-red-800 ring-red-200',
    pending:     'bg-slate-100 text-slate-600 ring-slate-200',
    applied:     'bg-amber-100 text-amber-800 ring-amber-200',
    received:    'bg-emerald-100 text-emerald-800 ring-emerald-200',
    in_progress: 'bg-blue-100 text-blue-800 ring-blue-200',
    complete:    'bg-emerald-100 text-emerald-800 ring-emerald-200',
  }
  return map[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active:      'Active',
    on_hold:     'On Hold',
    completed:   'Completed',
    cancelled:   'Cancelled',
    pending:     'Pending',
    applied:     'Applied',
    received:    'Received',
    in_progress: 'In Progress',
    complete:    'Complete',
    villa:       'Villa',
    renovation:  'Renovation',
  }
  return map[status] ?? status
}
