import fs from 'fs'
import path from 'path'
import type { QBTokens } from './types'

const TOKEN_FILE = path.join(process.cwd(), '.qb-tokens.json')
let tokenCache: QBTokens | null | undefined

export function loadTokens(): QBTokens | null {
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

export function saveTokens(tokens: QBTokens): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8')
    tokenCache = tokens
  } catch (error) {
    console.error('Error saving QB tokens:', error)
  }
}

export function clearTokens(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE)
    }
    tokenCache = null
  } catch (error) {
    console.error('Error clearing QB tokens:', error)
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