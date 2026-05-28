import { Users } from 'lucide-react'
export default function HRPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
      <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center">
        <Users className="w-8 h-8 text-purple-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">HR &amp; Admin</h1>
      <p className="text-slate-500 max-w-sm">Employee records, payroll, attendance and labour management — coming soon.</p>
      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Coming Soon</span>
    </div>
  )
}
