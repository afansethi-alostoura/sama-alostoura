import { FolderOpen } from 'lucide-react'
export default function DocumentsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
        <FolderOpen className="w-8 h-8 text-blue-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
      <p className="text-slate-500 max-w-sm">Central document library for all company files, templates and archives — coming soon.</p>
      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Coming Soon</span>
    </div>
  )
}
