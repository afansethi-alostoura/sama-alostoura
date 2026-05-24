import Link from 'next/link'
import { Building2, Calculator, TrendingUp, Home } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="ml-64 min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Welcome to Sama Alostoura AI OS</h1>
          <p className="text-slate-600 mt-2">Construction Management & Estimation System</p>
        </div>

        {/* Quick Access */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <Link href="/projects">
            <div className="bg-white rounded-xl border border-slate-200 p-8 hover:shadow-lg transition-all cursor-pointer">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Projects</h3>
              <p className="text-slate-500 text-sm mt-2">Manage construction projects, track progress and finances</p>
            </div>
          </Link>

          <Link href="/estimation">
            <div className="bg-white rounded-xl border border-slate-200 p-8 hover:shadow-lg transition-all cursor-pointer">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                <Calculator className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Estimation Engineer</h3>
              <p className="text-slate-500 text-sm mt-2">Generate accurate BOQs from architectural drawings using AI</p>
            </div>
          </Link>

          <Link href="/accounting">
            <div className="bg-white rounded-xl border border-slate-200 p-8 hover:shadow-lg transition-all cursor-pointer">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Accounting</h3>
              <p className="text-slate-500 text-sm mt-2">Track finances, payments, and financial reporting</p>
            </div>
          </Link>
        </div>

        {/* Getting Started */}
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Getting Started</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-semibold">1</div>
              <div>
                <h3 className="font-semibold text-slate-900">Upload a Drawing</h3>
                <p className="text-slate-600 text-sm">Go to Estimation Engineer and upload your architectural drawing (PDF, JPG, PNG, DWG, or DXF)</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 font-semibold">2</div>
              <div>
                <h3 className="font-semibold text-slate-900">AI Extraction</h3>
                <p className="text-slate-600 text-sm">Our AI analyzes the drawing and extracts dimensions to generate a complete BOQ automatically</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center flex-shrink-0 font-semibold">3</div>
              <div>
                <h3 className="font-semibold text-slate-900">Review & Export</h3>
                <p className="text-slate-600 text-sm">Edit quantities and rates as needed, then export a professional PDF BOQ with company branding</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Available Features</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-900 mb-2">✓ Estimation Engineer (Phase 1)</h4>
              <p className="text-sm text-slate-600">AI-powered BOQ generation from drawings with auto-calculated quantities and professional PDF export</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-900 mb-2">✓ Projects Management</h4>
              <p className="text-sm text-slate-600">Track construction projects, progress, and financial status in real-time</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-900 mb-2">✓ Accounting</h4>
              <p className="text-sm text-slate-600">Financial tracking, payment schedules, and reporting</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Future: More Modules</h4>
              <p className="text-sm text-slate-600">Procurement, HR, Site Reports, and more coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
