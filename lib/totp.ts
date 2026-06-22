import crypto from 'crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function b32decode(s: string): Buffer {
  let bits = 0, val = 0
  const out: number[] = []
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    const idx = B32.indexOf(c)
    if (idx === -1) continue
    val = (val << 5) | idx
    bits += 5
    if (bits >= 8) { bits -= 8; out.push((val >> bits) & 0xff) }
  }
  return Buffer.from(out)
}

function b32encode(buf: Buffer): string {
  let bits = 0, val = 0, out = ''
  for (const byte of buf) {
    val = (val << 8) | byte; bits += 8
    while (bits >= 5) { bits -= 5; out += B32[(val >> bits) & 31] }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31]
  return out
}

export function generateSecret(): string {
  return b32encode(crypto.randomBytes(20))
}

export function getOtpAuthUrl(secret: string): string {
  const label   = encodeURIComponent('Sama Alostoura:Admin')
  const issuer  = encodeURIComponent('Sama Alostoura')
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  let c = counter
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256) }
  const hmac  = crypto.createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code   = ((hmac[offset] & 0x7f) << 24) | (hmac[offset+1] << 16) | (hmac[offset+2] << 8) | hmac[offset+3]
  return String(code % 1_000_000).padStart(6, '0')
}

export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const key   = b32decode(secret)
    const step  = Math.floor(Date.now() / 1000 / 30)
    // Accept current window ± 1 (covers clock drift)
    for (const delta of [-1, 0, 1]) {
      if (hotp(key, step + delta) === token) return true
    }
    return false
  } catch { return false }
}
