import { describe, it, expect } from 'vitest'
import { guardJson, BodyError } from '../respond'

const req = (body: string, len?: number) =>
  new Request('http://x/api', { method: 'POST', headers: { 'content-type': 'application/json', ...(len != null ? { 'content-length': String(len) } : {}) }, body })

describe('guardJson — legacy-route body guard', () => {
  it('passes a normal object through unchanged', async () => {
    const d = await guardJson(req(JSON.stringify({ titleEn: 'Hello', sortOrder: 2, tags: ['a'] })))
    expect(d).toEqual({ titleEn: 'Hello', sortOrder: 2, tags: ['a'] })
  })
  it('rejects invalid JSON and non-object bodies', async () => {
    await expect(guardJson(req('{oops'))).rejects.toBeInstanceOf(BodyError)
    await expect(guardJson(req('"just a string"'))).rejects.toBeInstanceOf(BodyError)
    await expect(guardJson(req('null'))).rejects.toBeInstanceOf(BodyError)
  })
  it('rejects prototype-pollution keys anywhere in the tree', async () => {
    await expect(guardJson(req('{"__proto__":{"admin":true}}'))).rejects.toBeInstanceOf(BodyError)
    await expect(guardJson(req('{"a":{"b":{"constructor":{"x":1}}}}'))).rejects.toBeInstanceOf(BodyError)
  })
  it('rejects oversized bodies and excessive nesting', async () => {
    const big = JSON.stringify({ data: 'x'.repeat(600 * 1024) })
    await expect(guardJson(req(big))).rejects.toBeInstanceOf(BodyError)
    let nested = '1'
    for (let i = 0; i < 15; i++) nested = `{"a":${nested}}`
    await expect(guardJson(req(nested))).rejects.toBeInstanceOf(BodyError)
  })
  it('accepts top-level arrays (reorder payloads) within limits', async () => {
    const d = await guardJson<number[]>(req(JSON.stringify([1, 2, 3])))
    expect(d).toEqual([1, 2, 3])
  })
})
