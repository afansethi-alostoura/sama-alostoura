import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Client-side client (anon key) — used in browser components
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any

// Server-side admin client (service role key) — bypasses RLS, server only
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)   // fallback to anon if no service key
    : null

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && (supabaseAnonKey || serviceRoleKey))
}