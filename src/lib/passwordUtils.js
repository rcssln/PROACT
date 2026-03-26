/**
 * Per-rule validation for live feedback.
 * Returns { length: boolean, uppercase: boolean, lowercase: boolean, number: boolean, allValid: boolean }.
 */
export function getPasswordRules(password) {
  const p = password || ''
  const length = p.length >= 8
  const uppercase = /[A-Z]/.test(p)
  const lowercase = /[a-z]/.test(p)
  const number = /[0-9]/.test(p)
  return {
    length,
    uppercase,
    lowercase,
    number,
    allValid: length && uppercase && lowercase && number,
  }
}

/**
 * Password validation: at least 8 characters, one uppercase, one lowercase, one digit.
 * Returns { valid: boolean, message: string }.
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' }
  }
  const rules = getPasswordRules(password)
  if (!rules.length) {
    return { valid: false, message: 'Password must be at least 8 characters.' }
  }
  if (!rules.uppercase) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' }
  }
  if (!rules.lowercase) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' }
  }
  if (!rules.number) {
    return { valid: false, message: 'Password must contain at least one number.' }
  }
  return { valid: true, message: '' }
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const DIGITS = '23456789'
const ALL = UPPER + LOWER + DIGITS

/** Cryptographically secure random integer in [0, max). */
function cryptoRandInt(max) {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] % max
}

/**
 * Generate a temporary password using a CSPRNG.
 * Guarantees at least one uppercase, one lowercase, one digit.
 * Safe for one-time OTP / email notification.
 */
export function generateTemporaryPassword() {
  const length = 12
  const chars = [
    UPPER[cryptoRandInt(UPPER.length)],
    LOWER[cryptoRandInt(LOWER.length)],
    DIGITS[cryptoRandInt(DIGITS.length)],
  ]
  for (let i = chars.length; i < length; i++) {
    chars.push(ALL[cryptoRandInt(ALL.length)])
  }
  // Fisher-Yates shuffle with crypto-random swaps
  for (let i = chars.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/**
 * Hash password for storage using Web Crypto API (SHA-256 with per-user salt).
 * For best security, pass the user's email (or another unique value) as the salt.
 * Returns Promise<string> (hex-encoded hash).
 *
 * @param {string} password
 * @param {string} userSalt - a unique per-user value, e.g. the user's email address
 */
export async function hashPassword(password, userSalt = '') {
  const encoder = new TextEncoder()
  // Combine a fixed app prefix + unique per-user value so two users with the
  // same password never produce the same hash.
  const salt = 'rdrms-c1:' + userSalt.toLowerCase().trim()
  const data = encoder.encode(salt + password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
