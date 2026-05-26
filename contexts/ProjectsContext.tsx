'use client'
/**
 * Global project state — one fetch, shared by every page.
 *
 * Provided at layout level (root-layout-wrapper.tsx) so all pages
 * read from the same in-memory state. When progress is saved on any
 * page, call refresh() and every mounted component updates instantly.
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react'

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
  notes:            string
  boq_sections:     unknown[]
  mbhre_approved_amount?:   number
  mbhre_approved_progress?: number
  plot_number?:             string
  [key: string]:            unknown
}

interface ProjectsContextValue {
  projects:          ProjectRow[]
  loading:           boolean
  refresh:           () => Promise<void>
  // Derived
  activeProjects:    ProjectRow[]
  completedProjects: ProjectRow[]
  totalContract:     number
  totalReceived:     number
  totalOutstanding:  number
}

const ProjectsContext = createContext<ProjectsContextValue>({
  projects: [], loading: true,
  refresh: async () => {},
  activeProjects: [], completedProjects: [],
  totalContract: 0, totalReceived: 0, totalOutstanding: 0,
})

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const fetchingRef = useRef(false)

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return   // prevent duplicate concurrent fetches
    fetchingRef.current = true
    try {
      const res  = await fetch('/api/projects')
      const data = await res.json() as ProjectRow[]
      setProjects(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('ProjectsContext fetch failed:', err)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => { refresh() }, [refresh])

  const activeProjects    = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const totalContract     = projects.reduce((s, p) => s + p.contract_value,  0)
  const totalReceived     = projects.reduce((s, p) => s + p.received_amount, 0)
  const totalOutstanding  = totalContract - totalReceived

  return (
    <ProjectsContext.Provider value={{
      projects, loading, refresh,
      activeProjects, completedProjects,
      totalContract, totalReceived, totalOutstanding,
    }}>
      {children}
    </ProjectsContext.Provider>
  )
}

/** Use this hook in any page/component to get live project data */
export function useProjects() {
  return useContext(ProjectsContext)
}
