/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest'
import { encryptionService } from './encryption.service'

vi.mock('electron-log/main', () => ({ default: { warn: vi.fn() } }))
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`, 'utf8'),
    decryptString: (b: Buffer) => {
      const x = b.toString('utf8')
      return x.startsWith('enc:') ? x.slice(4) : x
    }
  }
}))

describe('encryption.service', () => {
  it('encrypts and decrypts round-trip', () => {
    const plain = 'my-secret-password'
    const encrypted = encryptionService.encrypt(plain)
    expect(encrypted).not.toBe(plain)
    expect(encryptionService.decrypt(encrypted, true)).toBe(plain)
  })
})
