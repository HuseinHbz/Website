/**
 * Password hashing (Phase 26.25b بند ۰.۲). Moved OFF pure-JS bcrypt (work factor
 * 12 ≈ 460ms, run on the main thread → event-loop starvation under concurrent
 * logins) onto Node's async `crypto.scrypt`, which runs on the libuv thread pool
 * → parallel, NON-blocking. Existing bcrypt hashes still verify (back-compat) and
 * are transparently re-hashed to scrypt on the next successful login (no forced
 * password reset). Decision was made by measurement — see the phase report.
 */
import { scrypt as scryptCb, randomBytes, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import bcrypt from 'bcryptjs'

// scrypt params: N=2^15 (CPU/memory cost), r=8, p=1, 64-byte key. Async on the
// thread pool, so ~tens of ms wall-time each WITHOUT blocking the event loop.
const N = 32768, R = 8, P = 1, KEYLEN = 64
const PREFIX = 'scrypt'

/** Promise wrapper that carries the scrypt options (promisify drops the overload). */
function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, opts, (err, derived) => (err ? reject(err) : resolve(derived)))
  })
}

/** Hash a password with async scrypt → `scrypt$N$r$p$saltHex$hashHex`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })) as Buffer
  return `${PREFIX}$${N}$${R}$${P}$${salt.toString('hex')}$${derived.toString('hex')}`
}

/** True when a stored hash is the legacy bcrypt format (needs rehash on login). */
export function isBcryptHash(stored: string): boolean {
  return stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')
}

/**
 * Verify a password against a stored hash (scrypt or legacy bcrypt). Returns
 * `needsRehash` when the stored hash is bcrypt so the caller can upgrade it.
 */
export async function verifyPassword(password: string, stored: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (isBcryptHash(stored)) {
    const valid = await bcrypt.compare(password, stored)
    return { valid, needsRehash: valid }   // upgrade to scrypt on success
  }
  const parts = stored.split('$')
  if (parts[0] !== PREFIX || parts.length !== 6) return { valid: false, needsRehash: false }
  const [, n, r, p, saltHex, hashHex] = parts
  try {
    const derived = (await scrypt(password, Buffer.from(saltHex, 'hex'), KEYLEN, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 })) as Buffer
    const expected = Buffer.from(hashHex, 'hex')
    const valid = derived.length === expected.length && timingSafeEqual(derived, expected)
    return { valid, needsRehash: false }
  } catch { return { valid: false, needsRehash: false } }
}
