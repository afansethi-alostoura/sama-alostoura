'use client'
/**
 * Single source of truth for all project data.
 *
 * Fetches /api/projects which returns:
 *   - Real projects from .projects-data.json
 *   - WITH Supabase progress overrides applied (progress_percent, current_stage, boq_sections)
 *   - PLUS DEMO_PROJECTS as fallbacks for any projects not in the file store
 *
 * All pages that display project data should use this hook so any progress
 * update saved to Supabase is immediately reflected everywhere.
 */
import { useState, useEffect, useCallback } from 'react'

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

  useEffect(() => { refresh() }, [refresh])

  // Derived helpers
  const activeProjects    = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const totalContract     = projects.reduce((s, p) => s + p.contract_value,  0)
  const totalReceived     = projects.reduce((s, p) => s + p.received_amount, 0)
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
    totalOutstanding,
  }
}
