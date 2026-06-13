'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
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
      router.push('/')
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

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

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter username" disabled={loading} autoFocus autoComplete="username"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter password" disabled={loading} autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition disabled:opacity-50"
              />
            </div>

            <button
              type="submit" disabled={loading || !username || !password}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
                : <><Lock className="w-4 h-4" />Sign In</>
              }
            </button>
          </form>

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
