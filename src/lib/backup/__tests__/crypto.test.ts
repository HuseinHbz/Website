import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { encryptFile, decryptFile, sha256File, sha256, usingDedicatedKey } from '../crypto'

describe('backup crypto layer', () => {
  beforeAll(() => { process.env.BACKUP_ENCRYPTION_KEY = 'test-key-for-backup-encryption-1234567890' })

  it('round-trips a file through AES encryption (decrypt restores exact bytes)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'crypto-test-'))
    try {
      const src = path.join(dir, 'plain.bin')
      const enc = path.join(dir, 'cipher.enc')
      const dec = path.join(dir, 'restored.bin')
      const payload = Buffer.concat([Buffer.from('HBZ backup payload — بکاپ '), Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256))])
      await writeFile(src, payload)

      await encryptFile(src, enc)
      await decryptFile(enc, dec)

      const restored = await readFile(dec)
      expect(restored.equals(payload)).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('ciphertext differs from plaintext and each encryption uses a fresh salt/iv', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'crypto-test-'))
    try {
      const src = path.join(dir, 'p.txt')
      await writeFile(src, 'same input every time')
      const a = path.join(dir, 'a.enc'); const b = path.join(dir, 'b.enc')
      await encryptFile(src, a); await encryptFile(src, b)
      const [ca, cb, plain] = [await readFile(a), await readFile(b), await readFile(src)]
      expect(ca.equals(cb)).toBe(false) // random salt+iv → different ciphertext
      expect(ca.includes(plain)).toBe(false) // not stored in the clear
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('sha256 file + string helpers are stable and consistent', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'crypto-test-'))
    try {
      const f = path.join(dir, 'x.txt')
      await writeFile(f, 'checksum me')
      expect(await sha256File(f)).toBe(sha256('checksum me'))
      expect(usingDedicatedKey()).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
