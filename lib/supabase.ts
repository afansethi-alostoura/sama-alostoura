import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL        ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   ?? ''
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY       ?? ''

// Supports both legacy JWT keys (eyJ...) and new Supabase key format (sb_publishable_ / sb_secret_)

// Client-side client (anon / publishable key)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : null as any

// Server-side admin client (service role / secret key) — bypasses RLS
// Falls back to anon key if service role is not configured
const adminKey = serviceRoleKey || supabaseAnonKey
export const supabaseAdmin = supabaseUrl && adminKey
  ? createClient(supabaseUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && (supabaseAnonKey || serviceRoleKey))
}