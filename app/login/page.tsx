'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, MessageCircle, Lock, RefreshCw, CheckCircle2 } from 'lucide-react'

// ── OTP 6-box input ───────────────────────────────────────────────────────────
function OTPInput({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled: boolean
}) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null))

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs[i - 1].current?.focus()
  }

  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/g, '').slice(-1)
    const arr   = value.split('')
    arr[i]      = digit
    const next  = arr.join('').padEnd(6, ' ').slice(0, 6).replace(/ /g, '')
    onChange(next)
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
          key={i}
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          disabled={disabled}
          className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all disabled:opacity-50 border-slate-300 text-slate-800"
        />
      ))}
    </div>
  )
}

// ── Countdown timer ───────────────────────────────────────────────────────────
function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    const t = setInterval(() => setLeft(l => {
      if (l <= 1) { clearInterval(t); onExpire(); return 0 }
      return l - 1
    }), 1000)
    return () => clearInterval(t)
  }, [onExpire])
  const m = Math.floor(left / 60)
  const s = left % 60
  return (
    <span className={`font-mono font-bold ${left <= 60 ? 'text-red-600' : 'text-slate-700'}`}>
      {m}:{String(s).padStart(2, '0')}
    </span>
  )
}

// ── Main login page ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'password' | 'whatsapp'>('password')

  // Password state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // WhatsApp OTP state
  const [otpStep, setOtpStep]       = useState<'request' | 'verify'>('request')
  const [otp, setOtp]               = useState('')
  const [sentTo, setSentTo]         = useState('')
  const [expired, setExpired]       = useState(false)

  // Shared
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // ── Password login ──────────────────────────────────────────────────────────
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  // ── Request OTP ─────────────────────────────────────────────────────────────
  async function requestOTP() {
    setError(''); setLoading(true); setExpired(false); setOtp('')
    try {
      const res  = await fetch('/api/auth/request-otp', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); setLoading(false); return }
      setSentTo(data.sentTo ?? '')
      setOtpStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    }
    setLoading(false)
  }

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  async function verifyOTP() {
    if (otp.length !== 6) return
    setError(''); setLoading(true)
    try {
      const res  = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); setLoading(false); return }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setLoading(false)
    }
  }

  function switchTab(t: 'password' | 'whatsapp') {
    setTab(t); setError(''); setOtpStep('request'); setOtp('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background shapes */}
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

          {/* Tab switcher */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => switchTab('password')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === 'password'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Lock className="w-4 h-4" />
              Password
            </button>
            <button
              onClick={() => switchTab('whatsapp')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === 'whatsapp'
                  ? 'border-green-600 text-green-700 bg-green-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp OTP
            </button>
          </div>

          {/* ── Password tab ─────────────────────────────────────────────────── */}
          {tab === 'password' && (
            <form onSubmit={handlePasswordLogin} className="px-8 py-8 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username" disabled={loading} autoFocus
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password" disabled={loading}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition disabled:opacity-50" />
              </div>
              <button type="submit" disabled={loading || !username || !password}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── WhatsApp OTP tab ──────────────────────────────────────────────── */}
          {tab === 'whatsapp' && (
            <div className="px-8 py-8 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Step 1 — Request */}
              {otpStep === 'request' && (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                    <MessageCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Login with WhatsApp</p>
                    <p className="text-sm text-slate-500 mt-1">
                      We'll send a 6-digit code to your admin WhatsApp number.
                    </p>
                  </div>
                  <button onClick={requestOTP} disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                      : <><MessageCircle className="w-4 h-4" />Send OTP to WhatsApp</>
                    }
                  </button>
                </div>
              )}

              {/* Step 2 — Verify */}
              {otpStep === 'verify' && (
                <div className="space-y-6">
                  {/* Sent confirmation */}
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Code sent!</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Sent to {sentTo || 'your WhatsApp number'}
                      </p>
                    </div>
                  </div>

                  {/* OTP boxes */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700 text-center">
                      Enter the 6-digit code
                    </label>
                    <OTPInput value={otp} onChange={setOtp} disabled={loading || expired} />
                  </div>

                  {/* Timer */}
                  {!expired ? (
                    <div className="text-center text-sm text-slate-500">
                      Expires in{' '}
                      <Countdown seconds={600} onExpire={() => setExpired(true)} />
                    </div>
                  ) : (
                    <div className="text-center text-sm text-red-600 font-medium">
                      Code expired.
                    </div>
                  )}

                  {/* Verify button */}
                  {!expired && (
                    <button
                      onClick={verifyOTP}
                      disabled={loading || otp.length !== 6}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</>
                        : 'Verify & Sign In'
                      }
                    </button>
                  )}

                  {/* Resend */}
                  <button
                    onClick={() => { setOtpStep('request'); setOtp(''); setError(''); setExpired(false) }}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 py-2 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Send a new code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Sama Alostoura Building Contracting LLC · Dubai, UAE
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
