import type { QBInvoice } from '@/lib/quickbooks/types'
import { formatDate }     from '@/lib/utils'

function statusBadge(inv: QBInvoice): { label: string; cls: string } {
  if (inv.Balance === 0) return { label: 'Paid',    cls: 'bg-emerald-100 text-emerald-800' }
  if (inv.DueDate && new Date(inv.DueDate) < new Date())
    return { label: 'Overdue', cls: 'bg-red-100 text-red-800' }
  return { label: 'Unpaid',  cls: 'bg-amber-100 text-amber-800' }
}

function daysOverdue(dueDate?: string): number | null {
  if (!dueDate) return null
  const d = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000)
  return d > 0 ? d : null
}

export function InvoiceTable({ invoices }: { invoices: QBInvoice[] }) {
  const totalBilled      = invoices.reduce((s, i) => s + i.TotalAmt, 0)
  const totalOutstanding = invoices.reduce((s, i) => s + i.Balance, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Invoices from QuickBooks</h3>
        <div className="text-xs text-slate-500">
          <span className="font-medium text-slate-800">AED {totalBilled.toLocaleString()}</span> billed ·{' '}
          <span className="font-medium text-amber-700">AED {totalOutstanding.toLocaleString()}</span> outstanding
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs">
              <th className="text-left px-5 py-3 font-medium">Invoice #</th>
              <th className="text-left px-5 py-3 font-medium">Client</th>
              <th className="text-left px-5 py-3 font-medium">Date</th>
              <th className="text-left px-5 py-3 font-medium">Due</th>
              <th className="text-right px-5 py-3 font-medium">Amount</th>
              <th className="text-right px-5 py-3 font-medium">Balance</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.map(inv => {
              const { label, cls } = statusBadge(inv)
              const overdue        = daysOverdue(inv.DueDate)
              return (
                <tr key={inv.Id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-700">#{inv.DocNumber}</td>
                  <td className="px-5 py-3.5 text-slate-600">{inv.CustomerRef.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{formatDate(inv.TxnDate)}</td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {formatDate(inv.DueDate ?? null)}
                    {overdue && <span className="ml-1 text-red-600 text-xs">({overdue}d)</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                    AED {inv.TotalAmt.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-amber-700">
                    {inv.Balance > 0 ? `AED ${inv.Balance.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">No invoices yet. Sync QuickBooks to see your data.</p>
        )}
      </div>
    </div>
  )
}
