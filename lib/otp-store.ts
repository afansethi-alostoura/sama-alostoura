/**
 * Shared in-memory OTP state.
 * Imported by login (to send OTP after credential check) and
 * verify-otp (to validate the submitted code).
 *
 * Single-admin system — one pending OTP at a time is enough.
 */

export const OTP_TTL_MS   = 10 * 60 * 1000   // 10 minutes
export const MAX_ATTEMPTS = 3

export interface OTPRecord {
  code:        string
  expiresAt:   number
  attempts:    number
  requestedAt: number
}

let _otp: OTPRecord | null = null

export function getPendingOTP(): OTPRecord | null { return _otp }

export function setPendingOTP(record: OTPRecord): void { _otp = record }

export function clearPendingOTP(): void { _otp = null }

export function markWrongAttempt(): void {
  if (_otp) _otp.attempts++
}

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
