import { ShoppingCart } from 'lucide-react'
export default function ProcurementPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
      <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center">
        <ShoppingCart className="w-8 h-8 text-orange-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Procurement</h1>
      <p className="text-slate-500 max-w-sm">Purchase orders, supplier management and material tracking — coming soon.</p>
      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">Coming Soon</span>
    </div>
  )
}
