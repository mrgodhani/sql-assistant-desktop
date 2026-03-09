import { safeStorage } from 'electron'
import log from 'electron-log/main'

class EncryptionService {
  private available: boolean | null = null

  isAvailable(): boolean {
    if (this.available === null) {
      this.available = safeStorage.isEncryptionAvailable()
      if (!this.available) {
        log.warn('[Encryption] safeStorage is not available — API keys will be stored in plaintext')
      }
    }
    return this.available
  }

  encrypt(value: string): string {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is unavailable. Credentials cannot be saved.')
    }
    const encrypted = safeStorage.encryptString(value)
    return encrypted.toString('base64')
  }

  decrypt(value: string, isEncrypted: boolean): string {
    if (!isEncrypted) {
      return value
    }
    if (!this.isAvailable()) {
      return value
    }
    const buffer = Buffer.from(value, 'base64')
    return safeStorage.decryptString(buffer)
  }
}

export const encryptionService = new EncryptionService()
