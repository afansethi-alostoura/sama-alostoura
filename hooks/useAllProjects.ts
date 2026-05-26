'use client'
/**
 * Thin re-export for backwards compatibility.
 * All pages should use useProjects() from contexts/ProjectsContext directly.
 */
export { useProjects as useAllProjects, type ProjectRow } from '@/contexts/ProjectsContext'
