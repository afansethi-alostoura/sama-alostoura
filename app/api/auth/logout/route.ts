import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('sama-session')

    return NextResponse.json({
      success: true,
      message: 'Logout successful',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Logout error: ${message}` },
      { status: 500 }
    )
  }
}
