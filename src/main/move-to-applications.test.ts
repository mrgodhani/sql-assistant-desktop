/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureMoveToApplicationsPrompt } from './move-to-applications'

const { mockShowMessageBox, mockMoveToApplicationsFolder, mockIsInApplicationsFolder, isMock } =
  vi.hoisted(() => ({
    mockShowMessageBox: vi.fn(),
    mockMoveToApplicationsFolder: vi.fn(),
    mockIsInApplicationsFolder: vi.fn(),
    isMock: { dev: false }
  }))

vi.mock('electron', () => ({
  app: {
    isInApplicationsFolder: () => mockIsInApplicationsFolder(),
    moveToApplicationsFolder: () => mockMoveToApplicationsFolder()
  },
  dialog: {
    showMessageBox: (...args: unknown[]) => mockShowMessageBox(...args)
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: isMock
}))

vi.mock('./services/settings.service', () => ({
  settingsService: {
    get: vi.fn(),
    set: vi.fn()
  }
}))

const { settingsService } = await import('./services/settings.service')

describe('promptMoveToApplicationsIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMock.dev = false
    vi.mocked(settingsService.get).mockResolvedValue(null)
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
  })

  it('returns early when is.dev', async () => {
    isMock.dev = true

    await ensureMoveToApplicationsPrompt()

    expect(mockIsInApplicationsFolder).not.toHaveBeenCalled()
    expect(mockShowMessageBox).not.toHaveBeenCalled()
  })

  it('returns early when not darwin', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    await ensureMoveToApplicationsPrompt()

    expect(mockIsInApplicationsFolder).not.toHaveBeenCalled()
    expect(mockShowMessageBox).not.toHaveBeenCalled()
  })

  it('returns early when already in Applications', async () => {
    mockIsInApplicationsFolder.mockReturnValue(true)

    await ensureMoveToApplicationsPrompt()

    expect(mockShowMessageBox).not.toHaveBeenCalled()
    expect(mockMoveToApplicationsFolder).not.toHaveBeenCalled()
  })

  it('returns early when opted out', async () => {
    mockIsInApplicationsFolder.mockReturnValue(false)
    vi.mocked(settingsService.get).mockResolvedValue('true')

    await ensureMoveToApplicationsPrompt()

    expect(mockShowMessageBox).not.toHaveBeenCalled()
  })

  it('shows dialog when outside Applications', async () => {
    mockIsInApplicationsFolder.mockReturnValue(false)
    mockShowMessageBox.mockResolvedValue({ response: 1, checkboxChecked: false })

    await ensureMoveToApplicationsPrompt()

    expect(mockShowMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'question',
        title: 'Move to Applications?',
        message: expect.stringContaining('Applications folder'),
        buttons: ['Move', 'Later'],
        defaultId: 0,
        checkboxLabel: "Don't ask again"
      })
    )
  })

  it('persists opt-out when Later + checkbox checked', async () => {
    mockIsInApplicationsFolder.mockReturnValue(false)
    mockShowMessageBox.mockResolvedValue({ response: 1, checkboxChecked: true })

    await ensureMoveToApplicationsPrompt()

    expect(settingsService.set).toHaveBeenCalledWith('skipMoveToApplicationsPrompt', 'true')
  })

  it('calls moveToApplicationsFolder when Move', async () => {
    mockIsInApplicationsFolder.mockReturnValue(false)
    mockShowMessageBox.mockResolvedValue({ response: 0, checkboxChecked: false })
    mockMoveToApplicationsFolder.mockReturnValue(true)

    await ensureMoveToApplicationsPrompt()

    expect(mockMoveToApplicationsFolder).toHaveBeenCalled()
  })

  it('shows error when move returns false', async () => {
    mockIsInApplicationsFolder.mockReturnValue(false)
    mockShowMessageBox
      .mockResolvedValueOnce({ response: 0, checkboxChecked: false })
      .mockResolvedValueOnce(undefined)
    mockMoveToApplicationsFolder.mockReturnValue(false)

    await ensureMoveToApplicationsPrompt()

    expect(mockShowMessageBox).toHaveBeenCalledTimes(2)
    expect(mockShowMessageBox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Could Not Move',
        message: expect.stringContaining('Could not move SQL Assist')
      })
    )
  })
})
