/**
 * Token storage — reads/writes .qb-tokens.json in the project root.
 * In production swap this module for a Supabase-backed implementation.
 */
import fs   from 'fs'
import path from 'path'
import type { QBTokens } from './types'

const TOKEN_FILE = path.join(process.cwd(), '.qb-tokens.json')

export function saveTokens(tokens: QBTokens): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8')
}

export function loadTokens(): QBTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) as QBTokens
  } catch {
    return null
  }
}

export function clearTokens(): void {
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE)
}

/** True if access token is still valid (with 60-second buffer) */
export function isAccessTokenFresh(tokens: QBTokens): boolean {
  const expiresAt = tokens.created_at + tokens.expires_in * 1000 - 60_000
  return Date.now() < expiresAt
}

/** True if refresh token has not expired */
export function isRefreshTokenValid(tokens: QBTokens): boolean {
  const expiresAt = tokens.created_at + tokens.x_refresh_token_expires_in * 1000
  return Date.now() < expiresAt
}
