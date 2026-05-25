import type { QBTokens } from './types'
import { supabase } from '@/lib/supabase'
import fs from 'fs'
import path from 'path'

const TOKEN_FILE = path.join(process.cwd(), '.qb-tokens.json')
let tokenCache: QBTokens | null | undefined

async function loadFromSupabase(): Promise<QBTokens | null> {
  try {
    const { data, error } = await supabase
      .from('qb_tokens')
      .select('*')
      .single()

    if (error || !data) {
      return null
    }

    const tokens: QBTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      realm_id: data.realm_id,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in ?? 3600,
      x_refresh_token_expires_in: data.x_refresh_token_expires_in,
      created_at: data.created_at,
    }

    return tokens
  } catch (error) {
    console.error('Error loading QB tokens from Supabase:', error)
    return null
  }
}

async function loadFromFile(): Promise<QBTokens | null> {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null
    }
    const data = fs.readFileSync(TOKEN_FILE, 'utf-8')
    return JSON.parse(data) as QBTokens
  } catch (error) {
    console.error('Error loading QB tokens from file:', error)
    return null
  }
}

export function loadTokens(): QBTokens | null {
  // Synchronous version for use in server contexts
  // This is a fallback - async version should be preferred
  if (tokenCache !== undefined) {
    return tokenCache
  }

  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      tokenCache = null
      return null
    }
    const data = fs.readFileSync(TOKEN_FILE, 'utf-8')
    tokenCache = JSON.parse(data) as QBTokens
    return tokenCache
  } catch (error) {
    console.error('Error loading QB tokens:', error)
    tokenCache = null
    return null
  }
}

export async function loadTokensAsync(): Promise<QBTokens | null> {
  // Try Supabase first (preferred for production)
  let tokens = await loadFromSupabase()
  if (tokens) {
    tokenCache = tokens
    return tokens
  }

  // Fallback to file for local development
  tokens = await loadFromFile()
  if (tokens) {
    tokenCache = tokens
  }
  return tokens
}

export async function saveTokens(tokens: QBTokens): Promise<void> {
  tokenCache = tokens

  // Try to save to Supabase (production)
  try {
    const { error } = await supabase
      .from('qb_tokens')
      .upsert({
        realm_id: tokens.realm_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        x_refresh_token_expires_in: tokens.x_refresh_token_expires_in,
        created_at: tokens.created_at,
      })

    if (!error) return
  } catch (error) {
    console.error('Error saving QB tokens to Supabase:', error)
  }

  // Fallback to file for local development
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving QB tokens to file:', error)
  }
}

export async function clearTokens(): Promise<void> {
  tokenCache = null

  // Clear from Supabase
  try {
    await supabase.from('qb_tokens').delete().neq('id', '')
  } catch (error) {
    console.error('Error clearing QB tokens from Supabase:', error)
  }

  // Clear from file
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE)
    }
  } catch (error) {
    console.error('Error clearing QB tokens from file:', error)
  }
}

export function isAccessTokenFresh(tokens: QBTokens): boolean {
  if (!tokens.access_token) return false
  const expiresIn = tokens.expires_in ?? 3600
  const age = (Date.now() - tokens.created_at) / 1000
  return age < expiresIn - 300
}

export function isRefreshTokenValid(tokens: QBTokens): boolean {
  if (!tokens.refresh_token) return false
  const maxAge = 100 * 24 * 60 * 60 * 1000
  const age = Date.now() - tokens.created_at
  return age < maxAge
}