import { validateEnv } from '../env'

describe('validateEnv', () => {
  const original = process.env

  afterEach(() => {
    process.env = { ...original }
  })

  it('reports error when ADMIN_JWT_SECRET is missing', () => {
    delete process.env.ADMIN_JWT_SECRET
    const { ok, errors } = validateEnv()
    expect(ok).toBe(false)
    expect(errors.some(e => e.includes('ADMIN_JWT_SECRET'))).toBe(true)
  })

  it('passes when required vars are set', () => {
    process.env.ADMIN_JWT_SECRET = 'a-strong-secret-that-is-long-enough'
    const { ok, errors } = validateEnv()
    expect(ok).toBe(true)
    expect(errors).toHaveLength(0)
  })

  it('warns on missing recommended vars', () => {
    process.env.ADMIN_JWT_SECRET = 'strong-secret'
    delete process.env.SMTP_HOST
    const { warnings } = validateEnv()
    expect(warnings.some(w => w.includes('SMTP_HOST'))).toBe(true)
  })
})
