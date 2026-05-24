import type { WorkStage } from '@/types'
import { formatDate, statusBadge, statusLabel } from '@/lib/utils'
import { CheckCircle2, Circle, Loader } from 'lucide-react'

const ICON = {
  complete:    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  in_progress: <Loader className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  pending:     <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />,
}

export function WorkStagesList({ stages }: { stages: WorkStage[] }) {
  const complete    = stages.filter(s => s.status === 'complete').length
  const in_progress = stages.filter(s => s.status === 'in_progress').length
  const pending     = stages.filter(s => s.status === 'pending').length

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Work Stages</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="text-emerald-600 font-medium">{complete} done</span>
          <span className="text-blue-600 font-medium">{in_progress} active</span>
          <span className="text-slate-400">{pending} pending</span>
        </div>
      </div>

      <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
        {stages.map(stage => (
          <div key={stage.id} className={`flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors ${stage.status === 'in_progress' ? 'bg-blue-50/40' : ''}`}>
            <div className="mt-0.5">{ICON[stage.status]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono w-4 flex-shrink-0">{stage.section_no}</span>
                <span className={`font-medium text-sm ${stage.status === 'complete' ? 'text-slate-500' : 'text-slate-800'}`}>
                  {stage.section_name}
                </span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ring-1 ${statusBadge(stage.status)}`}>
                  {statusLabel(stage.status)}
                </span>
              </div>
              {stage.description && (
                <p className="text-xs text-slate-500 mt-0.5 ml-6">{stage.description}</p>
              )}
              {stage.notes && (
                <p className="text-xs font-medium text-red-600 mt-0.5 ml-6">{stage.notes}</p>
              )}
            </div>
            {stage.completion_date && (
              <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(stage.completion_date)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
