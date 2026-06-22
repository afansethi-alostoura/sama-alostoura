'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react'

// ── 6-box code input ──────────────────────────────────────────────────────────
function CodeInput({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled: boolean
}) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null))

  useEffect(() => { refs[0].current?.focus() }, [])

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs[i - 1].current?.focus()
  }

  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/g, '').slice(-1)
    const arr   = (value + '      ').slice(0, 6).split('')
    arr[i]      = digit
    onChange(arr.join('').trimEnd())
    if (digit && i < 5) refs[i + 1].current?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) { onChange(pasted); refs[5].current?.focus() }
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {refs.map((ref, i) => (
        <input
          key={i} ref={ref} type="text" inputMode="numeric" maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          disabled={disabled}
          className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50 border-slate-300 text-slate-800"
        />
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const [step,     setStep]     = useState<'credentials' | 'totp'>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code,     setCode]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Step 1 — validate credentials
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed.'); setLoading(false); return }

      if (data.step === 'done') {
        router.push('/'); return
      }

      setCode(''); setStep('totp')
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  // Step 2 — verify TOTP
  async function handleVerify() {
    if (code.replace(/\s/g, '').length !== 6) return
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code.'); setLoading(false); return }
      router.push('/')
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (step === 'totp' && code.replace(/\s/g, '').length === 6 && !loading) {
      handleVerify()
    }
  }, [code])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500 opacity-10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-500 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-brand-50 to-white px-8 py-10 text-center border-b border-slate-100">
            <div className="flex justify-center mb-5 h-14">
              <img src="/logo.png" alt="Sama Alostoura" className="h-full w-auto object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sama Alostoura</h1>
            <p className="text-slate-500 text-sm mt-1">AI Construction OS</p>
          </div>

          {/* ── Step 1: Credentials ── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="px-8 py-8 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username" disabled={loading} autoFocus autoComplete="username"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password" disabled={loading} autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition disabled:opacity-50" />
              </div>
              <button type="submit" disabled={loading || !username || !password}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Checking…</>
                  : <><Lock className="w-4 h-4" />Continue</>}
              </button>
              <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                Secured with Google Authenticator (2FA)
              </p>
            </form>
          )}

          {/* ── Step 2: Google Authenticator TOTP ── */}
          {step === 'totp' && (
            <div className="px-8 py-8 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Two-Factor Authentication</p>
                  <p className="text-xs text-blue-700 mt-0.5">Open <strong>Google Authenticator</strong> and enter the 6-digit code for <strong>Sama Alostoura</strong></p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 text-center">
                  Enter the 6-digit code
                </label>
                <CodeInput value={code} onChange={setCode} disabled={loading} />
                <p className="text-xs text-center text-slate-400">Code refreshes every 30 seconds</p>
              </div>

              {code.replace(/\s/g, '').length === 6 && (
                <button onClick={handleVerify} disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</>
                    : <><ShieldCheck className="w-4 h-4" />Verify & Sign In</>}
                </button>
              )}

              <button onClick={() => { setStep('credentials'); setCode(''); setError('') }}
                className="w-full text-sm text-slate-400 hover:text-slate-600 py-2 transition-colors">
                ← Back to login
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">Sama Alostoura Building Contracting LLC · Dubai, UAE</p>
          </div>
        </div>
      </div>
    </div>
  )
}
