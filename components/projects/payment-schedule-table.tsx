import type { PaymentSchedule } from '@/types'
import { formatCurrency, formatDate, statusBadge, statusLabel } from '@/lib/utils'
import { CheckCircle2, Clock, Send } from 'lucide-react'

const STATUS_ICON = {
  received:  <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  applied:   <Send className="w-4 h-4 text-amber-500" />,
  pending:   <Clock className="w-4 h-4 text-slate-400" />,
}

export function PaymentScheduleTable({ payments }: { payments: PaymentSchedule[] }) {
  const totalReceived = payments.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  const totalApplied  = payments.filter(p => p.status === 'applied').reduce((s, p) => s + p.amount, 0)
  const totalPending  = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  const grandTotal    = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">MBHRE Payment Schedule</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/> Received</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/> Applied</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"/> Pending</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs">
              <th className="text-left px-5 py-3 font-medium">Stage</th>
              <th className="text-left px-5 py-3 font-medium">Trigger Condition</th>
              <th className="text-right px-5 py-3 font-medium">Amount</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Applied</th>
              <th className="text-left px-5 py-3 font-medium">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {STATUS_ICON[p.status]}
                    <span className="font-medium text-slate-700">Stage {p.payment_number}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-600 max-w-xs">
                  {p.trigger_condition}
                  {p.notes && (
                    <p className="text-xs text-amber-600 mt-0.5">{p.notes}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${statusBadge(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-500">{formatDate(p.applied_date)}</td>
                <td className="px-5 py-3.5 text-slate-500">{formatDate(p.received_date)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={2} className="px-5 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wide">Summary</td>
              <td className="px-5 py-3 text-right font-bold text-slate-900">{formatCurrency(grandTotal)}</td>
              <td colSpan={3} className="px-5 py-3">
                <span className="text-emerald-600 text-xs font-medium">{formatCurrency(totalReceived)} received</span>
                {totalApplied > 0 && (
                  <span className="text-amber-600 text-xs font-medium ml-3">{formatCurrency(totalApplied)} applied</span>
                )}
                <span className="text-slate-400 text-xs ml-3">{formatCurrency(totalPending)} pending</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
