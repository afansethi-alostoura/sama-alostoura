import { UserPlus } from 'lucide-react'
export default function LeadsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
      <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center">
        <UserPlus className="w-8 h-8 text-cyan-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
      <p className="text-slate-500 max-w-sm">New enquiries, client pipeline and proposal tracking — coming soon.</p>
      <span className="px-3 py-1 bg-cyan-100 text-cyan-700 text-xs font-semibold rounded-full">Coming Soon</span>
    </div>
  )
}
