import type { QBTokens } from './types'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

let tokenCache: QBTokens | null | undefined

// ── Supabase (production) ────────────────────────────────────

async function loadFromSupabase(): Promise<QBTokens | null> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return null
  try {
    const { data, error } = await supabaseAdmin
      .from('qb_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      if (error?.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('[QB Tokens] Supabase load error:', error?.message)
      }
      return null
    }

    return {
      access_token:               data.access_token,
      refresh_token:              data.refresh_token,
      realm_id:                   data.realm_id,
      token_type:                 data.token_type ?? 'Bearer',
      expires_in:                 data.expires_in ?? 3600,
      x_refresh_token_expires_in: data.x_refresh_token_expires_in,
      created_at:                 data.created_at,
    } as QBTokens
  } catch (err) {
    console.error('[QB Tokens] Supabase load exception:', err)
    return null
  }
}

async function saveToSupabase(tokens: QBTokens): Promise<void> {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    throw new Error('Supabase not configured — cannot save QB tokens on Vercel (read-only filesystem)')
  }

  const { error } = await supabaseAdmin
    .from('qb_tokens')
    .upsert({
      realm_id:                   tokens.realm_id,
      access_token:               tokens.access_token,
      refresh_token:              tokens.refresh_token,
      token_type:                 tokens.token_type,
      expires_in:                 tokens.expires_in,
      x_refresh_token_expires_in: tokens.x_refresh_token_expires_in,
      created_at:                 tokens.created_at,
    }, { onConflict: 'realm_id' })

  if (error) {
    console.error('[QB Tokens] Supabase save error:', error)
    throw new Error(`Failed to save QB tokens to Supabase: ${error.message}`)
  }
  console.log('[QB Tokens] ✅ Tokens saved to Supabase')
}

// ── File (local dev only) ────────────────────────────────────

function loadFromFileSync(): QBTokens | null {
  if (process.env.NODE_ENV === 'production') return null
  try {
    const fs   = require('fs')   as typeof import('fs')
    const path = require('path') as typeof import('path')
    const file = path.join(process.cwd(), '.qb-tokens.json')
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as QBTokens
  } catch {
    return null
  }
}

function saveToFileSync(tokens: QBTokens): void {
  if (process.env.NODE_ENV === 'production') return
  try {
    const fs   = require('fs')   as typeof import('fs')
    const path = require('path') as typeof import('path')
    const file = path.join(process.cwd(), '.qb-tokens.json')
    fs.writeFileSync(file, JSON.stringify(tokens, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[QB Tokens] File save skipped (read-only fs):', err)
  }
}

// ── Public API ───────────────────────────────────────────────

/** Sync load — returns in-memory cache only (use loadTokensAsync in routes) */
export function loadTokens(): QBTokens | null {
  return tokenCache ?? null
}

/** Async load — tries Supabase first, then local file (dev only) */
export async function loadTokensAsync(): Promise<QBTokens | null> {
  if (tokenCache !== undefined) return tokenCache

  let tokens = await loadFromSupabase()
  if (!tokens) tokens = loadFromFileSync()

  tokenCache = tokens
  return tokens
}

/** Save tokens — Supabase in production, file in development */
export async function saveTokens(tokens: QBTokens): Promise<void> {
  tokenCache = tokens

  if (isSupabaseConfigured() && supabaseAdmin) {
    await saveToSupabase(tokens)
  } else {
    console.warn('[QB Tokens] Supabase not configured — saving to file (dev mode only)')
    saveToFileSync(tokens)
  }
}

/** Clear tokens from Supabase and memory */
export async function clearTokens(): Promise<void> {
  tokenCache = null

  if (isSupabaseConfigured() && supabaseAdmin) {
    try {
      await supabaseAdmin.from('qb_tokens').delete().neq('realm_id', '')
      console.log('[QB Tokens] Tokens cleared from Supabase')
    } catch (err) {
      console.error('[QB Tokens] Clear error:', err)
    }
  }

  // Clear local file in dev
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
  const age = Date.now() - tokens.created_at
  return age < 100 * 24 * 60 * 60 * 1000 // 100 days
}
