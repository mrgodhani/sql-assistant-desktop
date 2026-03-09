/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron-log/main', () => ({ default: { warn: vi.fn(), error: vi.fn() } }))
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}))

const { encryptionService } = await import('./encryption.service')

describe('encryption.service (unavailable)', () => {
  it('throws on encrypt when safeStorage is unavailable', () => {
    expect(() => encryptionService.encrypt('secret')).toThrow('Secure storage is unavailable')
  })

  it('returns plaintext on decrypt for unencrypted legacy data', () => {
    expect(encryptionService.decrypt('plain-value', false)).toBe('plain-value')
  })
})
