import { parseTrustProxy } from './trust-proxy'

describe('parseTrustProxy', () => {
  it('не задано — один прокси (Railway)', () => {
    expect(parseTrustProxy(undefined)).toBe(1)
    expect(parseTrustProxy(null)).toBe(1)
    expect(parseTrustProxy('')).toBe(1)
    expect(parseTrustProxy('  ')).toBe(1)
  })

  it('число прокси; ноль — без прокси', () => {
    expect(parseTrustProxy('1')).toBe(1)
    expect(parseTrustProxy('2')).toBe(2)
    expect(parseTrustProxy('0')).toBe(false)
  })

  it('false/off — прокси нет, true — доверять всем', () => {
    expect(parseTrustProxy('false')).toBe(false)
    expect(parseTrustProxy('OFF')).toBe(false)
    expect(parseTrustProxy('true')).toBe(true)
  })

  it('список подсетей остаётся строкой для Express', () => {
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8')
  })
})
