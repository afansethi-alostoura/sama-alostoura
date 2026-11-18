/**
 * POST /api/staff/daily-followup/respond
 * Called when a staff member submits their project update via the follow-up link.
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { token, response } = await req.json()
    if (!token || !response?.trim()) {
      return NextResponse.json({ error: 'token and response required' }, { status: 400 })
    }

    // Find the follow-up record
    const rows = await query(
      `SELECT f.*, s.name AS staff_name, s.id AS sid
       FROM staff_followups f JOIN staff_members s ON s.id = f.staff_id
       WHERE f.token = $1`,
      [token]
    ) as Array<{ id: number; staff_id: number; project_name: string; sid: number; staff_name: string; status: string }>

    if (!rows.length) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    const followup = rows[0]

    // Update follow-up record
    await query(
      `UPDATE staff_followups SET response=$1, responded_at=NOW(), status='responded' WHERE token=$2`,
      [response.trim(), token]
    )

    // Log in staff_activities
    await query(
      `INSERT INTO staff_activities (staff_id, note, created_by) VALUES ($1, $2, $3)`,
      [followup.staff_id, `📋 Project update (${followup.project_name}): ${response.trim()}`, followup.staff_name]
    )

    return NextResponse.json({ success: true, project: followup.project_name, staff: followup.staff_name })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Return today's follow-up status summary
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = await query(`
      SELECT f.*, s.name AS staff_name, s.role
      FROM staff_followups f
      JOIN staff_members s ON s.id = f.staff_id
      WHERE f.sent_at >= $1
      ORDER BY f.sent_at DESC
    `, [today.toISOString()])
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}
