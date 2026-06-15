'use client'
import { useState, useEffect, useCallback } from 'react'

/** Fire this after any project data change (edit, QB sync, etc.)
 *  All useAllProjects instances on the page will re-fetch automatically. */
export function broadcastProjectUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projects-updated'))
  }
}

export interface ProjectRow {
  id:               string
  name:             string
  client_name:      string
  location:         string
  type:             string
  status:           'active' | 'on_hold' | 'completed' | 'cancelled'
  contract_value:   number
  received_amount:  number
  progress_percent: number
  current_stage:    string
  start_date:       string
  expected_completion: string
  created_at:       string
  updated_at:       string
  notes?:           string
  boq_sections?:    unknown[]
  // QuickBooks sync
  qb_class_name?:   string
  total_expenses?:  number
  last_qb_sync?:    string
  // MBHRE / extra metadata
  mbhre_approved_amount?:   number
  mbhre_approved_progress?: number
  plot_number?:             string
  [key: string]:            unknown
}

export function useAllProjects() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/projects')
      const data = await res.json() as ProjectRow[]
      setProjects(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('useAllProjects fetch failed:', err)
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Re-fetch whenever any page broadcasts a project update
    window.addEventListener('projects-updated', refresh)
    return () => window.removeEventListener('projects-updated', refresh)
  }, [refresh])

  // Derived helpers
  const activeProjects    = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const totalContract     = projects.reduce((s, p) => s + p.contract_value,    0)
  const totalReceived     = projects.reduce((s, p) => s + p.received_amount,   0)
  const totalExpenses     = projects.reduce((s, p) => s + (p.total_expenses ?? 0), 0)
  const totalOutstanding  = totalContract - totalReceived

  return {
    projects,
    loading,
    error,
    refresh,
    activeProjects,
    completedProjects,
    totalContract,
    totalReceived,
    totalExpenses,
    totalOutstanding,
  }
}
