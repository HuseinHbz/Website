import { describe, it, expect } from 'vitest'
import path from 'path'
import { isAllowedUploadFolder, resolveUploadDir, UPLOAD_FOLDER_ALLOWLIST } from '../uploadPath'

const ROOT = '/app/public/uploads'

describe('isAllowedUploadFolder', () => {
  it('accepts every folder actually used by an upload call site', () => {
    for (const f of UPLOAD_FOLDER_ALLOWLIST) expect(isAllowedUploadFolder(f)).toBe(true)
  })
  it('rejects anything not in the exact allowlist', () => {
    expect(isAllowedUploadFolder('random-folder')).toBe(false)
    expect(isAllowedUploadFolder('')).toBe(false)
  })
})

describe('resolveUploadDir — Path Traversal attack matrix', () => {
  // The exact payload list from the security review.
  const attacks = [
    '../',
    '../../',
    '../../../etc',
    '/etc/',
    '/etc/passwd',
    'C:\\Windows\\',
    'C:\\Windows\\System32',
    '%2e%2e/',
    '%2e%2e%2f',
    '..%2f',
    '..%2f..%2f',
    'profile\0.evil',
    'profile/../../../etc',
    'profile\\..\\..\\etc',
    'general/../../secrets',
    '....//....//etc',
    'a/b/c',
    '.',
    '..',
  ]

  it.each(attacks)('rejects payload: %j', (payload) => {
    const result = resolveUploadDir(ROOT, payload)
    expect(result.ok).toBe(false)
  })

  it('accepts every allowlisted folder and resolves strictly inside the root', () => {
    for (const folder of UPLOAD_FOLDER_ALLOWLIST) {
      const result = resolveUploadDir(ROOT, folder)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.dir.startsWith(path.resolve(ROOT) + path.sep) || result.dir === path.resolve(ROOT)).toBe(true)
        expect(result.dir).toBe(path.resolve(ROOT, folder))
      }
    }
  })

  it('rejects a folder that LOOKS allowlisted but has a traversal suffix appended', () => {
    // Guards against a naive `folder.startsWith('profile')` style check —
    // this must fail the exact-match allowlist test, not a prefix check.
    expect(resolveUploadDir(ROOT, 'profile/../../etc').ok).toBe(false)
    expect(resolveUploadDir(ROOT, 'profile;rm -rf').ok).toBe(false)
  })

  it('defense-in-depth: even a hypothetically permissive allowlist entry cannot escape the root', () => {
    // Simulates the second, independent guard by resolving a value that
    // isn't exact-allowlisted but would escape if only prefix-checked.
    const escaped = resolveUploadDir(ROOT, '../outside')
    expect(escaped.ok).toBe(false)
  })
})
