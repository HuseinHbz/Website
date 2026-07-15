import { describe, it, expect } from 'vitest'
import { parseCaps, inboundRateExceeded, DEFAULT_INBOUND_CAPS } from '../inboundPolicy'

describe('inboundPolicy — flood control (26.25b بند ۰.۶)', () => {
  it('parseCaps falls back to sane defaults on junk/empty', () => {
    expect(parseCaps({})).toEqual(DEFAULT_INBOUND_CAPS)
    expect(parseCaps({ global: '', channel: 'x', window: null })).toEqual(DEFAULT_INBOUND_CAPS)
    expect(parseCaps({ global: '-5', channel: '0', window: '1.9' })).toEqual({ ...DEFAULT_INBOUND_CAPS, windowMinutes: 1 })
  })

  it('parseCaps honours explicit numeric config', () => {
    expect(parseCaps({ global: '10', channel: '5', window: '30' })).toEqual({ globalPerWindow: 10, perChannelPerWindow: 5, windowMinutes: 30 })
  })

  const caps = { globalPerWindow: 200, perChannelPerWindow: 100, windowMinutes: 60 }

  it('accepts below both caps', () => {
    expect(inboundRateExceeded(50, 30, caps)).toEqual({ exceeded: false })
  })

  it('blocks on the per-channel cap first when the channel is saturated', () => {
    expect(inboundRateExceeded(120, 100, caps)).toEqual({ exceeded: true, reason: 'channel' })
  })

  it('blocks on the global cap even when a single channel is quiet', () => {
    expect(inboundRateExceeded(200, 5, caps)).toEqual({ exceeded: true, reason: 'global' })
  })

  it('the cap is the MAX accepted (>= boundary): 199/99 ok, 200/100 blocked', () => {
    expect(inboundRateExceeded(199, 99, caps).exceeded).toBe(false)
    expect(inboundRateExceeded(200, 99, caps).exceeded).toBe(true)
    expect(inboundRateExceeded(199, 100, caps).exceeded).toBe(true)
  })

  it('1000-message flood: only the first cap-count are accepted, the rest blocked', () => {
    let accepted = 0
    for (let i = 0; i < 1000; i++) {
      // simulate a single-channel flood: channelCount == globalCount == accepted so far
      if (!inboundRateExceeded(accepted, accepted, caps).exceeded) accepted++
    }
    expect(accepted).toBe(100) // per-channel cap bites first → funnel stays clean
  })
})
