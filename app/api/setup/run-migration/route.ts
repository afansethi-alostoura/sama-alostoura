/**
 * POST /api/setup/run-migration
 *
 * One-time migration runner — adds classes/purchases/bills columns
 * to qb_snapshot via the Supabase Management API.
 *
 * Requires a Supabase Personal Access Token (different from service role key):
 *   https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   curl -X POST https://your-app.vercel.app/api/setup/run-migration \
 *     -H "Content-Type: application/json" \
 *     -d '{"access_token":"sbp_XXXX..."}'
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MIGRATION_SQL = `
-- Create qb_snapshot if it doesn't exist
CREATE TABLE IF NOT EXISTS qb_snapshot (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  realm_id     TEXT,
  company_name TEXT,
  synced_at    TEXT,
  invoices     JSONB DEFAULT '[]'::jsonb,
  payments     JSONB DEFAULT '[]'::jsonb,
  customers    JSONB DEFAULT '[]'::jsonb,
  classes      JSONB DEFAULT '[]'::jsonb,
  purchases    JSONB DEFAULT '[]'::jsonb,
  bills        JSONB DEFAULT '[]'::jsonb
);

-- Add new columns to existing table (safe if already present)
ALTER TABLE qb_snapshot
  ADD COLUMN IF NOT EXISTS classes   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS purchases JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bills     JSONB DEFAULT '[]'::jsonb;

-- GIN indexes for faster JSONB lookups
CREATE INDEX IF NOT EXISTS idx_qb_snapshot_classes
  ON qb_snapshot USING GIN (classes);
CREATE INDEX IF NOT EXISTS idx_qb_snapshot_purchases
  ON qb_snapshot USING GIN (purchases);
CREATE INDEX IF NOT EXISTS idx_qb_snapshot_bills
  ON qb_snapshot USING GIN (bills);
`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const access_token: string = body.access_token ?? ''

    if (!access_token) {
      return NextResponse.json(
        {
          error: 'access_token required',
          help: 'Get your Personal Access Token from https://supabase.com/dashboard/account/tokens',
          example: 'curl -X POST <this-url> -H "Content-Type: application/json" -d \'{"access_token":"sbp_..."}\'',
        },
        { status: 400 },
      )
    }

    // Extract project ref from runtime Supabase URL env var
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const projectRef  = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

    if (!projectRef) {
      return NextResponse.json(
        { error: `Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}"` },
        { status: 500 },
      )
    }

    console.log(`[migration] Running against project: ${projectRef}`)

    // Call Supabase Management API
    const apiRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: MIGRATION_SQL }),
      },
    )

    const responseText = await apiRes.text()

    if (!apiRes.ok) {
      console.error('[migration] Management API error:', apiRes.status, responseText)
      return NextResponse.json(
        { error: `Management API returned ${apiRes.status}`, detail: responseText },
        { status: apiRes.status },
      )
    }

    console.log('[migration] ✅ Migration completed successfully')

    return NextResponse.json({
      success:     true,
      project_ref: projectRef,
      message:     'Migration completed — qb_snapshot now has classes, purchases, bills columns. Run a QB Sync to populate them.',
    })
  } catch (err) {
    console.error('[migration] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    )
  }
}
