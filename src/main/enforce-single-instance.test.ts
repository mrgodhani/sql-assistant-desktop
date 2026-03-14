/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enforceSingleInstance } from './enforce-single-instance'

const {
  mockRequestSingleInstanceLock,
  mockQuit,
  mockOn,
  mockGetAllWindows,
  mockFocus,
  mockRestore,
  mockIsMinimized
} = vi.hoisted(() => ({
  mockRequestSingleInstanceLock: vi.fn(),
  mockQuit: vi.fn(),
  mockOn: vi.fn(),
  mockGetAllWindows: vi.fn(),
  mockFocus: vi.fn(),
  mockRestore: vi.fn(),
  mockIsMinimized: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: () => mockRequestSingleInstanceLock(),
    quit: () => mockQuit(),
    on: (...args: unknown[]) => mockOn(...args)
  },
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows()
  }
}))

describe('enforceSingleInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false and quits when lock is not granted', () => {
    mockRequestSingleInstanceLock.mockReturnValue(false)

    const result = enforceSingleInstance()

    expect(mockQuit).toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('returns true and registers second-instance handler when lock is granted', () => {
    mockRequestSingleInstanceLock.mockReturnValue(true)

    const result = enforceSingleInstance()

    expect(mockQuit).not.toHaveBeenCalled()
    expect(mockOn).toHaveBeenCalledWith('second-instance', expect.any(Function))
    expect(result).toBe(true)
  })

  it('focuses and restores minimized window on second-instance event', () => {
    mockRequestSingleInstanceLock.mockReturnValue(true)
    mockIsMinimized.mockReturnValue(true)

    const fakeWindow = {
      isMinimized: () => mockIsMinimized(),
      restore: () => mockRestore(),
      focus: () => mockFocus()
    }
    mockGetAllWindows.mockReturnValue([fakeWindow])

    enforceSingleInstance()

    const handler = mockOn.mock.calls.find(([event]) => event === 'second-instance')?.[1]
    expect(handler).toBeDefined()
    handler()

    expect(mockRestore).toHaveBeenCalled()
    expect(mockFocus).toHaveBeenCalled()
  })

  it('focuses non-minimized window on second-instance event', () => {
    mockRequestSingleInstanceLock.mockReturnValue(true)
    mockIsMinimized.mockReturnValue(false)

    const fakeWindow = {
      isMinimized: () => mockIsMinimized(),
      restore: () => mockRestore(),
      focus: () => mockFocus()
    }
    mockGetAllWindows.mockReturnValue([fakeWindow])

    enforceSingleInstance()

    const handler = mockOn.mock.calls.find(([event]) => event === 'second-instance')?.[1]
    handler()

    expect(mockRestore).not.toHaveBeenCalled()
    expect(mockFocus).toHaveBeenCalled()
  })

  it('does nothing on second-instance event if no windows exist', () => {
    mockRequestSingleInstanceLock.mockReturnValue(true)
    mockGetAllWindows.mockReturnValue([])

    enforceSingleInstance()

    const handler = mockOn.mock.calls.find(([event]) => event === 'second-instance')?.[1]
    expect(() => handler()).not.toThrow()
    expect(mockFocus).not.toHaveBeenCalled()
  })
})
