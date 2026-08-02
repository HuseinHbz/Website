'use client'

/**
 * Shared admin CRUD client + list hook.
 *
 * Every admin manager was reimplementing the same idiom:
 *   fetch('/api/admin/x')                                        // list
 *   fetch('/api/admin/x', { method, headers: {json}, body })     // create/update/delete
 * This centralizes it so the JSON headers, method selection (POST vs PUT by id)
 * and error handling live in one place.
 */
import { useCallback, useEffect, useState } from 'react'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    headers: body === undefined ? undefined : JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const crud = {
  /** GET a list; always resolves to an array (empty on any failure). */
  async list<T = unknown>(path: string): Promise<T[]> {
    try {
      const r = await send(path, 'GET')
      const d = await r.json()
      return Array.isArray(d) ? (d as T[]) : []
    } catch {
      return []
    }
  },
  /** GET a single object (or null on failure). */
  async get<T = unknown>(path: string): Promise<T | null> {
    try {
      const r = await send(path, 'GET')
      return (await r.json()) as T
    } catch {
      return null
    }
  },
  /** Create (POST) or update (PUT when the body carries an id). */
  save(path: string, body: { id?: number | string } & Record<string, unknown>): Promise<Response> {
    return send(path, body.id ? 'PUT' : 'POST', body)
  },
  /** PATCH-like partial update (always PUT). */
  patch(path: string, body: Record<string, unknown>): Promise<Response> {
    return send(path, 'PUT', body)
  },
  /** DELETE by id (sent in the JSON body, matching the admin route contract). */
  remove(path: string, id: number | string): Promise<Response> {
    return send(path, 'DELETE', { id })
  },
  /**
   * 26.29 — extract the server's error message from a failed Response so the
   * toast can show WHY ("Required field missing: slug") instead of a generic
   * "Failed" that makes the whole module look broken (BUG-101..109 class).
   */
  async errorOf(r: Response, fallback = 'Failed'): Promise<string> {
    try {
      const d = await r.clone().json() as { error?: string }
      return d?.error || fallback
    } catch { return fallback }
  },
}

/** Load a list resource with loading state and a stable `reload`. */
export function useResource<T = unknown>(path: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setData(await crud.list<T>(path))
    setLoading(false)
  }, [path])

  useEffect(() => { reload() }, [reload])

  return { data, setData, loading, reload }
}
