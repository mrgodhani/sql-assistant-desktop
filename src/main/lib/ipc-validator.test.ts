/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHandle = vi.fn()
vi.mock('electron', () => ({
  ipcMain: { handle: (...args: unknown[]) => mockHandle(...args) }
}))
const mockLogError = vi.fn()
vi.mock('electron-log/main', () => ({
  default: { error: (...args: unknown[]) => mockLogError(...args) }
}))

import {
  handleValidated,
  assertString,
  assertOptionalString,
  assertNumber,
  assertOptionalNumber,
  assertShape
} from './ipc-validator'

describe('ipc-validator', () => {
  beforeEach(() => {
    mockHandle.mockReset()
    mockLogError.mockReset()
  })

  describe('assertString', () => {
    it('returns trimmed string for valid input', () => {
      expect(assertString('  hello  ', 'field')).toBe('hello')
    })

    it('throws for non-string', () => {
      expect(() => assertString(123, 'field')).toThrow('field must be a string')
    })

    it('throws for empty string', () => {
      expect(() => assertString('', 'field')).toThrow('field is required')
    })

    it('throws for whitespace-only', () => {
      expect(() => assertString('  ', 'field')).toThrow('field is required')
    })

    it('throws for null', () => {
      expect(() => assertString(null, 'field')).toThrow('field must be a string')
    })

    it('throws for undefined', () => {
      expect(() => assertString(undefined, 'field')).toThrow('field must be a string')
    })
  })

  describe('assertOptionalString', () => {
    it('returns undefined for null', () => {
      expect(assertOptionalString(null, 'field')).toBeUndefined()
    })

    it('returns undefined for undefined', () => {
      expect(assertOptionalString(undefined, 'field')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(assertOptionalString('', 'field')).toBeUndefined()
    })

    it('returns trimmed string for valid input', () => {
      expect(assertOptionalString('  hello  ', 'field')).toBe('hello')
    })

    it('returns undefined for whitespace-only string', () => {
      expect(assertOptionalString('   ', 'field')).toBeUndefined()
    })

    it('throws for non-string non-null', () => {
      expect(() => assertOptionalString(123, 'field')).toThrow('field must be a string')
    })
  })

  describe('assertNumber', () => {
    it('returns number for valid input', () => {
      expect(assertNumber(42, 'field')).toBe(42)
    })

    it('throws for non-number', () => {
      expect(() => assertNumber('42', 'field')).toThrow('field must be a number')
    })

    it('throws for NaN', () => {
      expect(() => assertNumber(NaN, 'field')).toThrow('field must be a number')
    })
  })

  describe('assertOptionalNumber', () => {
    it('returns undefined for null', () => {
      expect(assertOptionalNumber(null, 'field')).toBeUndefined()
    })

    it('returns undefined for undefined', () => {
      expect(assertOptionalNumber(undefined, 'field')).toBeUndefined()
    })

    it('returns number for valid input', () => {
      expect(assertOptionalNumber(42, 'field')).toBe(42)
    })

    it('throws for non-number', () => {
      expect(() => assertOptionalNumber('42', 'field')).toThrow('field must be a number')
    })
  })

  describe('assertShape', () => {
    it('validates object with string fields', () => {
      const result = assertShape({ a: 'hello', b: 'world' }, { a: 'string', b: 'string' })
      expect(result).toEqual({ a: 'hello', b: 'world' })
    })

    it('trims string values', () => {
      const result = assertShape({ a: '  hello  ' }, { a: 'string' })
      expect(result).toEqual({ a: 'hello' })
    })

    it('throws for missing required field', () => {
      expect(() => assertShape({ a: 'hello' }, { a: 'string', b: 'string' })).toThrow(
        'b is required'
      )
    })

    it('throws for non-object input', () => {
      expect(() => assertShape('not-an-object', { a: 'string' })).toThrow('Expected an object')
    })

    it('throws for null input', () => {
      expect(() => assertShape(null, { a: 'string' })).toThrow('Expected an object')
    })

    it('validates number fields', () => {
      const result = assertShape({ count: 5 }, { count: 'number' })
      expect(result).toEqual({ count: 5 })
    })

    it('validates boolean fields', () => {
      const result = assertShape({ flag: true }, { flag: 'boolean' })
      expect(result).toEqual({ flag: true })
    })

    it('throws for wrong type', () => {
      expect(() => assertShape({ a: 123 }, { a: 'string' })).toThrow('a must be a string')
    })

    it('throws for empty string in required field', () => {
      expect(() => assertShape({ a: '  ' }, { a: 'string' })).toThrow('a is required')
    })

    it('throws for NaN in number field', () => {
      expect(() => assertShape({ count: NaN }, { count: 'number' })).toThrow(
        'count must be a number'
      )
    })
  })

  describe('handleValidated', () => {
    it('registers handler on ipcMain', () => {
      handleValidated(
        'test:channel',
        (args) => assertString(args, 'input'),
        async () => 'ok'
      )
      expect(mockHandle).toHaveBeenCalledWith('test:channel', expect.any(Function))
    })

    it('calls handler with validated input', async () => {
      const handler = vi.fn().mockResolvedValue('result')
      handleValidated('test:channel', (args) => assertString(args, 'input'), handler)

      const registeredFn = mockHandle.mock.calls[0][1]
      const result = await registeredFn({}, 'valid-input')
      expect(handler).toHaveBeenCalledWith('valid-input')
      expect(result).toBe('result')
    })

    it('throws when validation fails', async () => {
      handleValidated(
        'test:channel',
        (args) => assertString(args, 'input'),
        async () => 'ok'
      )

      const registeredFn = mockHandle.mock.calls[0][1]
      await expect(registeredFn({}, 123)).rejects.toThrow('input must be a string')
    })

    it('logs error when validation fails', async () => {
      handleValidated(
        'test:log',
        (args) => assertString(args, 'input'),
        async () => 'ok'
      )

      const registeredFn = mockHandle.mock.calls[0][1]
      await expect(registeredFn({}, 123)).rejects.toThrow('input must be a string')
      expect(mockLogError).toHaveBeenCalledWith(
        '[IPC:test:log] Validation failed:',
        'input must be a string'
      )
    })

    it('passes multiple args to validate function', async () => {
      const handler = vi.fn().mockResolvedValue('ok')
      handleValidated(
        'test:multi',
        (a, b) => ({ id: assertString(a, 'id'), name: assertString(b, 'name') }),
        handler
      )

      const registeredFn = mockHandle.mock.calls[0][1]
      await registeredFn({}, 'abc', 'John')
      expect(handler).toHaveBeenCalledWith({ id: 'abc', name: 'John' })
    })
  })
})
