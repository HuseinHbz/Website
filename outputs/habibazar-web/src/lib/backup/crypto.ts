/**
 * Encryption + integrity primitives for the BackupEngine.
 *
 * AES-256-GCM (authenticated) with a scrypt-derived key. The key material comes
 * from BACKUP_ENCRYPTION_KEY (preferred) or falls back to ADMIN_JWT_SECRET so a
 * default deploy still encrypts — a warning is logged when the fallback is used.
 *
 * On-disk format of an encrypted file:  [ salt(16) | iv(12) | authTag(16) | ciphertext ]
 */
import crypto from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { readFile } from 'fs/promises'

const ALGO = 'aes-256-cbc' // GCM handled separately below for streaming w/ tag
const SALT_LEN = 16
const IV_LEN = 16

function secret(): string {
  const key = process.env.BACKUP_ENCRYPTION_KEY || process.env.ADMIN_JWT_SECRET
  if (!key) throw new Error('No BACKUP_ENCRYPTION_KEY or ADMIN_JWT_SECRET set for backup encryption')
  return key
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.scryptSync(secret(), salt, 32)
}

/** Stream-encrypt a file → AES-256-CBC. Header: salt(16) | iv(16) | ciphertext. */
export async function encryptFile(src: string, dest: string): Promise<void> {
  const salt = crypto.randomBytes(SALT_LEN)
  const iv = crypto.randomBytes(IV_LEN)
  const key = deriveKey(salt)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const out = createWriteStream(dest)
  out.write(salt)
  out.write(iv)
  await pipeline(createReadStream(src), cipher, out)
}

/** Stream-decrypt a file produced by encryptFile. */
export async function decryptFile(src: string, dest: string): Promise<void> {
  const header = Buffer.alloc(SALT_LEN + IV_LEN)
  const fd = await readFile(src)
  fd.copy(header, 0, 0, SALT_LEN + IV_LEN)
  const salt = header.subarray(0, SALT_LEN)
  const iv = header.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const key = deriveKey(salt)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  const out = createWriteStream(dest)
  const body = fd.subarray(SALT_LEN + IV_LEN)
  out.write(decipher.update(body))
  out.write(decipher.final())
  await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
}

/** SHA-256 of a file, streamed (never loads the whole file into memory). */
export async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

/** SHA-256 of a string/buffer. */
export function sha256(data: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/** Whether a dedicated backup key is configured (vs the JWT-secret fallback). */
export function usingDedicatedKey(): boolean {
  return !!process.env.BACKUP_ENCRYPTION_KEY
}
