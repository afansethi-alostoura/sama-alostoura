/**
 * GET /api/quickbooks/class-list
 * Returns all active QB class names for the project QB-class picker dropdown.
 */
import { NextResponse }    from 'next/server'
import { fetchClasses }    from '@/lib/quickbooks/client'
import { loadTokensAsync } from '@/lib/quickbooks/tokens'

export const dynamic     = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 })
  }

  try {
    const classes = await fetchClasses(500)
    return NextResponse.json({
      classes: classes.map(c => ({ id: c.Id, name: c.FullyQualifiedName ?? c.Name })),
    })
  } catch (err) {
    console.error('[QB class-list]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
