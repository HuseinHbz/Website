import path from 'path'

/**
 * Path Traversal protection for the media upload write path.
 *
 * Found during a security re-review (26.34, prompted directly by a review
 * that correctly pointed out an earlier report had CLAIMED this was fixed
 * without ever actually implementing or testing it for the upload/write
 * side — only the read/serving route `/uploads/[...path]/route.ts` had
 * traversal protection). The client-supplied `folder` form field flowed
 * straight into `path.join(UPLOAD_ROOT, folder)` with zero validation —
 * a session with `brand.media` write access could set `folder` to
 * `../../../../etc` (or any other traversal payload) and write outside
 * the media root, limited only by the OS user's actual filesystem
 * permissions.
 *
 * Every folder ANY admin upload flow actually uses today, collected by
 * grepping every `fd.append('folder', …)` / `folder="…"` call site in the
 * codebase. `folder` MUST be one of these, full stop — never
 * client-defined, never dynamically extended by uploading itself.
 */
export const UPLOAD_FOLDER_ALLOWLIST = [
  'general', 'blog', 'projects', 'clients', 'logos', 'avatars', 'profile',
  'certifications', 'hero-orbit', 'hero-videos', 'diagrams', 'seo',
] as const

export type UploadFolder = (typeof UPLOAD_FOLDER_ALLOWLIST)[number]

export function isAllowedUploadFolder(folder: string): folder is UploadFolder {
  return (UPLOAD_FOLDER_ALLOWLIST as readonly string[]).includes(folder)
}

export interface ResolvedUploadDir {
  ok: true
  dir: string
}
export interface RejectedUploadDir {
  ok: false
  reason: 'not_allowlisted' | 'escapes_root'
}

/**
 * Resolves an upload-target directory for a client-supplied `folder`
 * value with two independent layers of defense:
 *   1. `folder` must be an EXACT allowlist match — not "doesn't contain
 *      `../`" (a denylist a Null-byte, a URL-encoded `%2e%2e/`, a bare
 *      absolute path `/etc/`, a Windows path `C:\Windows\`, or a
 *      backslash traversal can slip past piecemeal string checks; an
 *      allowlist has no such gaps because nothing outside the 12 exact
 *      strings above is ever accepted, period).
 *   2. Independently, after `path.resolve`, the final directory is
 *      re-verified to still be inside `uploadRoot` — defense in depth,
 *      so even a future allowlist bug (e.g. an accidentally permissive
 *      entry) can't actually escape the media root.
 */
export function resolveUploadDir(uploadRoot: string, folder: string): ResolvedUploadDir | RejectedUploadDir {
  if (!isAllowedUploadFolder(folder)) return { ok: false, reason: 'not_allowlisted' }
  const dir = path.resolve(uploadRoot, folder)
  const root = path.resolve(uploadRoot)
  if (dir !== root && !dir.startsWith(root + path.sep)) return { ok: false, reason: 'escapes_root' }
  return { ok: true, dir }
}
