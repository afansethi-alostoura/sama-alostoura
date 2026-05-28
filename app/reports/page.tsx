import { ClipboardList } from 'lucide-react'
export default function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
        <ClipboardList className="w-8 h-8 text-green-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Site Reports</h1>
      <p className="text-slate-500 max-w-sm">Daily site progress reports, inspection logs and photo documentation — coming soon.</p>
      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Coming Soon</span>
    </div>
  )
}
