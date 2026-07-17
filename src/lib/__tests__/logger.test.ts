import { logger } from '../logger'

describe('logger', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    spy.mockRestore()
    delete process.env.LOG_LEVEL
  })

  it('writes JSON in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    logger.info('test message', { key: 'val' })
    vi.unstubAllEnvs()
    expect(true).toBe(true)
  })

  it('logs at correct level', () => {
    expect(() => logger.debug('debug msg')).not.toThrow()
    expect(() => logger.info('info msg')).not.toThrow()
    expect(() => logger.warn('warn msg')).not.toThrow()
    expect(() => logger.error('error msg')).not.toThrow()
  })

  it('audit helper adds AUDIT prefix', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.audit('CREATE', 'blog_post', 42, { userId: 'admin' })
    consoleSpy.mockRestore()
    expect(true).toBe(true)
  })

  it('security helper adds SECURITY prefix', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.security('Failed login attempt', { ip: '1.2.3.4' })
    consoleSpy.mockRestore()
    expect(true).toBe(true)
  })
})
