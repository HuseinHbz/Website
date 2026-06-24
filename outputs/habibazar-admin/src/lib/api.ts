const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.habibazar.ir'

function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(error?.error?.message || res.statusText)
  }

  if (res.status === 204) return null
  return res.json()
}

export function apiGet(path: string) {
  return apiFetch(path)
}

export function apiPost(path: string, body: unknown) {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'x-csrf-token': getCsrfToken() },
    body: JSON.stringify(body),
  })
}

export function apiPatch(path: string, body: unknown) {
  return apiFetch(path, {
    method: 'PATCH',
    headers: { 'x-csrf-token': getCsrfToken() },
    body: JSON.stringify(body),
  })
}

export function apiDelete(path: string) {
  return apiFetch(path, {
    method: 'DELETE',
    headers: { 'x-csrf-token': getCsrfToken() },
  })
}

export { API_URL }
