import { describe, it, expect } from 'vitest'
import { COMMANDS, visibleCommands, entityActions } from '../commands'

describe('command registry', () => {
  it('has unique ids and every execute command targets an endpoint', () => {
    expect(new Set(COMMANDS.map(c => c.id)).size).toBe(COMMANDS.length)
    for (const c of COMMANDS) {
      if (c.kind === 'execute') { expect(c.endpoint).toBeTruthy(); expect(c.confirmEn).toBeTruthy() }
      if (c.kind === 'navigate') expect(c.href).toBeTruthy()
    }
  })
  it('RBAC-filters executable actions', () => {
    const ids = (role: string) => visibleCommands(role).map(c => c.id)
    expect(ids('super_admin')).toContain('run_backup')
    expect(ids('editor')).not.toContain('run_backup')   // needs manage_settings
    expect(ids('editor')).not.toContain('sync_ai_kb')
    expect(ids('editor')).toContain('open_search')       // no requirement
  })
  it('filters by query across title + keywords', () => {
    expect(visibleCommands('super_admin', 'backup').map(c => c.id)).toContain('run_backup')
    expect(visibleCommands('super_admin', 'rag').map(c => c.id)).toContain('sync_ai_kb')
    expect(visibleCommands('super_admin', 'zzz')).toHaveLength(0)
  })
})

describe('entityActions', () => {
  it('always offers open + copy, and a module list jump when known', () => {
    const a = entityActions('crm', '/admin/crm?lead=5')
    expect(a.map(x => x.id)).toEqual(['open', 'copy', 'list'])
    expect(a.find(x => x.id === 'open')?.href).toBe('/admin/crm?lead=5')
    expect(a.find(x => x.id === 'list')?.href).toBe('/admin/crm')
  })
  it('omits the list jump for an unknown module', () => {
    const a = entityActions('mystery', '/admin/x')
    expect(a.map(x => x.id)).toEqual(['open', 'copy'])
  })
})
