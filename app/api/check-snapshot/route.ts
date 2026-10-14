/**
 * ONE-TIME: Check qb_snapshot table raw contents.
 * DELETE after use.
 */
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const pool = getPool()
  const results: Record<string, unknown> = {}

  try {
    // List columns
    const cols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'qb_snapshot'
      ORDER BY ordinal_position
    `)
    results.columns = cols.rows.map((r: any) => `${r.column_name}:${r.data_type}`)
  } catch (e: any) {
    results.columns_error = e.message
  }

  try {
    // Count rows and show ids
    const rows = await pool.query(`SELECT id, realm_id, synced_at,
      CASE WHEN classes IS NULL THEN 'NULL' ELSE jsonb_array_length(classes)::text || ' items' END as classes_count
      FROM qb_snapshot`)
    results.rows = rows.rows
    results.row_count = rows.rowCount
  } catch (e: any) {
    results.rows_error = e.message
  }

  return NextResponse.json(results)
}
