import { describe, it, expect } from 'vitest'
import { isExecutable, buildRequest, redactConfig, backoffDelays, validateConnector, type Connector } from '../engine'

describe('executability', () => {
  it('marks REST/GraphQL/webhook/SMTP executable and brokers/SFTP as intents', () => {
    expect(isExecutable('rest')).toBe(true)
    expect(isExecutable('graphql')).toBe(true)
    expect(isExecutable('webhook')).toBe(true)
    expect(isExecutable('smtp')).toBe(true)
    expect(isExecutable('kafka')).toBe(false)
    expect(isExecutable('rabbitmq')).toBe(false)
    expect(isExecutable('sftp')).toBe(false)
  })
})

describe('buildRequest', () => {
  it('builds a REST request with bearer auth', () => {
    const c: Connector = { type: 'rest', config: { url: 'https://api.x/y', method: 'put', authType: 'bearer', authToken: 'T' } }
    const r = buildRequest(c, { a: 1 })
    expect(r.url).toBe('https://api.x/y')
    expect(r.method).toBe('PUT')
    expect(r.headers.Authorization).toBe('Bearer T')
    expect(r.body).toBe('{"a":1}')
  })
  it('wraps GraphQL payloads as {query, variables}', () => {
    const c: Connector = { type: 'graphql', config: { url: 'https://gql', query: 'query{ping}' } }
    const r = buildRequest(c, { id: 5 })
    expect(JSON.parse(r.body)).toEqual({ query: 'query{ping}', variables: { id: 5 } })
    expect(r.method).toBe('POST')
  })
  it('webhook is always POST with a custom auth header', () => {
    const c: Connector = { type: 'webhook', config: { url: 'https://hook', authType: 'header', authHeader: 'X-Key', authToken: 'S' } }
    const r = buildRequest(c, { e: 'x' })
    expect(r.method).toBe('POST')
    expect(r.headers['X-Key']).toBe('S')
  })
})

describe('redactConfig', () => {
  it('masks secret-looking values, keeps the rest', () => {
    const r = redactConfig({ url: 'https://x', authToken: 'sk-123', authHeader: 'X-Key' })
    expect(r.url).toBe('https://x')
    expect(r.authToken).toBe('••••••')
    expect(r.authHeader).toBe('X-Key') // header *name* is not a secret value
  })
})

describe('backoffDelays', () => {
  it('grows exponentially and caps', () => {
    expect(backoffDelays(3, 500, 2)).toEqual([500, 1000, 2000])
    expect(backoffDelays(3, 20000, 2, 30000)).toEqual([20000, 30000, 30000])
    expect(backoffDelays(0)).toEqual([])
  })
})

describe('validateConnector', () => {
  it('requires a url for HTTP connectors and a recipient for SMTP', () => {
    expect(validateConnector({ type: 'rest', config: {} }).valid).toBe(false)
    expect(validateConnector({ type: 'rest', config: { url: 'https://x' } }).valid).toBe(true)
    expect(validateConnector({ type: 'smtp', config: {} }).valid).toBe(false)
    expect(validateConnector({ type: 'smtp', config: { to: 'a@b.c' } }).valid).toBe(true)
    expect(validateConnector({ type: 'graphql', config: { url: 'x' } }).valid).toBe(false)
    expect(validateConnector({ type: 'kafka', config: {} }).valid).toBe(true) // intent, no url needed
  })
})
