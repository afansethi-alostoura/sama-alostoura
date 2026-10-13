import type { QBTokens } from './types'
import { query, queryOne, isDbConfigured } from '@/lib/db'

let tokenCache: QBTokens | null | undefined

// ── Railway PostgreSQL ────────────────────────────────────────

async function loadFromDb(): Promise<QBTokens | null> {
  if (!isDbConfigured()) return null
  try {
    const row = await queryOne<QBTokens>(
      'SELECT * FROM qb_tokens ORDER BY created_at DESC LIMIT 1',
    )
    return row ?? null
  } catch (err) {
    console.error('[QB Tokens] DB load error:', err)
    return null
  }
}

async function saveToDb(tokens: QBTokens): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error('DATABASE_URL not configured — cannot save QB tokens')
  }
  await query(
    `INSERT INTO qb_tokens
       (realm_id, access_token, refresh_token, token_type, expires_in, x_refresh_token_expires_in, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (realm_id) DO UPDATE
       SET access_token               = $2,
           refresh_token              = $3,
           token_type                 = $4,
           expires_in                 = $5,
           x_refresh_token_expires_in = $6,
           created_at                 = $7`,
    [
      tokens.realm_id,
      tokens.access_token,
      tokens.refresh_token,
      tokens.token_type   ?? 'Bearer',
      tokens.expires_in   ?? 3600,
      tokens.x_refresh_token_expires_in,
      tokens.created_at,
    ],
  )
  console.log('[QB Tokens] ✅ Tokens saved to Railway PostgreSQL')
}

// ── File (local dev only) ─────────────────────────────────────

function loadFromFileSync(): QBTokens | null {
  if (process.env.NODE_ENV === 'production') return null
  try {
    const fs   = require('fs')   as typeof import('fs')
    const path = require('path') as typeof import('path')
    const file = path.join(process.cwd(), '.qb-tokens.json')
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as QBTokens
  } catch { return null }
}

function saveToFileSync(tokens: QBTokens): void {
  if (process.env.NODE_ENV === 'production') return
  try {
    const fs   = require('fs')   as typeof import('fs')
    const path = require('path') as typeof import('path')
    fs.writeFileSync(path.join(process.cwd(), '.qb-tokens.json'), JSON.stringify(tokens, null, 2))
  } catch (err) {
    console.warn('[QB Tokens] File save skipped:', err)
  }
}

// ── Public API ────────────────────────────────────────────────

export function loadTokens(): QBTokens | null {
  return tokenCache ?? null
}

export async function loadTokensAsync(): Promise<QBTokens | null> {
  if (tokenCache !== undefined) return tokenCache
  let tokens = await loadFromDb()
  if (!tokens) tokens = loadFromFileSync()
  tokenCache = tokens
  return tokens
}

export async function saveTokens(tokens: QBTokens): Promise<void> {
  tokenCache = tokens
  if (isDbConfigured()) {
    await saveToDb(tokens)
  } else {
    console.warn('[QB Tokens] DATABASE_URL not set — saving to file (dev only)')
    saveToFileSync(tokens)
  }
}

export async function clearTokens(): Promise<void> {
  tokenCache = null
  if (isDbConfigured()) {
    try {
      await query("DELETE FROM qb_tokens WHERE realm_id != ''")
      console.log('[QB Tokens] Cleared from DB')
    } catch (err) {
      console.error('[QB Tokens] Clear error:', err)
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    try {
      const fs   = require('fs')   as typeof import('fs')
      const path = require('path') as typeof import('path')
      const file = path.join(process.cwd(), '.qb-tokens.json')
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } catch {}
  }
}

export function isAccessTokenFresh(tokens: QBTokens): boolean {
  if (!tokens.access_token) return false
  const age = (Date.now() - tokens.created_at) / 1000
  return age < (tokens.expires_in ?? 3600) - 300
}

export function isRefreshTokenValid(tokens: QBTokens): boolean {
  if (!tokens.refresh_token) return false
  return Date.now() - tokens.created_at < 100 * 24 * 60 * 60 * 1000
}
