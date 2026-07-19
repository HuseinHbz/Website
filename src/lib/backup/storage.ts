/**
 * Storage adapters for the BackupEngine — the "2 storage types / 1 offsite" half
 * of the 3-2-1 rule. All adapters are dependency-free (Node built-ins only) so no
 * heavy SDK enters the bundle.
 *
 *   - LocalDiskAdapter   — primary on-disk store (type 1)
 *   - MirrorDiskAdapter  — a second disk/mount (type 2), e.g. an attached volume
 *   - OffsiteAdapter     — offsite copy via rclone/rsync (S3/MinIO/SSH) if a
 *                          BACKUP_REMOTE target + tool are configured
 *
 * Layout under every adapter root:  {env}/{date}/{version}/{file}
 */
import { mkdir, copyFile, readdir, stat, rm } from 'fs/promises'
import { spawn } from 'child_process'
import path from 'path'

export type StorageKind = 'local' | 'mirror' | 'offsite-s3' | 'offsite-ssh'

export interface StoredCopy { adapter: string; kind: StorageKind; location: string }

export interface StorageAdapter {
  readonly name: string
  readonly kind: StorageKind
  /** Copy a local file to `rel` under this store; returns the stored location. */
  put(localFile: string, rel: string): Promise<StoredCopy>
  /** Absolute path/URI for a relative key (for reads/downloads). */
  resolve(rel: string): string
  remove(rel: string): Promise<void>
  /** Total bytes stored (best-effort; 0 for remote adapters). */
  usage(): Promise<number>
}

export class LocalDiskAdapter implements StorageAdapter {
  readonly kind: StorageKind = 'local'
  constructor(readonly name: string, private root: string) {}
  resolve(rel: string) { return path.join(this.root, rel) }
  async put(localFile: string, rel: string): Promise<StoredCopy> {
    const dest = this.resolve(rel)
    await mkdir(path.dirname(dest), { recursive: true })
    await copyFile(localFile, dest)
    return { adapter: this.name, kind: this.kind, location: dest }
  }
  async remove(rel: string) { await rm(this.resolve(rel), { force: true }) }
  async usage(): Promise<number> {
    async function walk(dir: string): Promise<number> {
      let total = 0
      let entries: string[] = []
      try { entries = await readdir(dir) } catch { return 0 }
      for (const e of entries) {
        const p = path.join(dir, e)
        const s = await stat(p).catch(() => null)
        if (!s) continue
        total += s.isDirectory() ? await walk(p) : s.size
      }
      return total
    }
    return walk(this.root)
  }
}

/** A second disk location — same mechanics as local, different root/mount. */
export class MirrorDiskAdapter extends LocalDiskAdapter {
  readonly kind: StorageKind = 'mirror'
}

/**
 * Offsite copy via rclone (S3/MinIO/any remote) or rsync (SSH). Configured with
 * BACKUP_REMOTE (e.g. "s3remote:habibazar" for rclone or "user@host:/backups" for
 * rsync). No-op-with-error if neither the target nor a suitable tool is present.
 */
export class OffsiteAdapter implements StorageAdapter {
  readonly name = 'offsite'
  readonly kind: StorageKind
  constructor(private remote: string) {
    this.kind = remote.includes('@') && remote.includes(':') && !remote.startsWith('s3') ? 'offsite-ssh' : 'offsite-s3'
  }
  resolve(rel: string) { return `${this.remote}/${rel}` }
  async put(localFile: string, rel: string): Promise<StoredCopy> {
    const dest = `${this.remote}/${rel}`
    if (this.kind === 'offsite-ssh') {
      await run('rsync', ['-a', localFile, dest])
    } else {
      // rclone copyto keeps the exact remote path
      await run('rclone', ['copyto', localFile, dest])
    }
    return { adapter: this.name, kind: this.kind, location: dest }
  }
  async remove(rel: string) {
    if (this.kind === 'offsite-s3') { try { await run('rclone', ['delete', `${this.remote}/${rel}`]) } catch { /* best-effort */ } }
  }
  async usage() { return 0 }
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'ignore' })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

/**
 * Build the configured adapter set. Local is always present. Mirror + offsite are
 * added when BACKUP_MIRROR_DIR / BACKUP_REMOTE are set, giving a real 3-2-1 chain.
 */
export function buildAdapters(primaryRoot: string): StorageAdapter[] {
  const adapters: StorageAdapter[] = [new LocalDiskAdapter('local', primaryRoot)]
  if (process.env.BACKUP_MIRROR_DIR) adapters.push(new MirrorDiskAdapter('mirror', process.env.BACKUP_MIRROR_DIR))
  if (process.env.BACKUP_REMOTE) adapters.push(new OffsiteAdapter(process.env.BACKUP_REMOTE))
  return adapters
}
