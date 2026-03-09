import { app, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { settingsService } from './services/settings.service'

const SKIP_KEY = 'skipMoveToApplicationsPrompt'

export async function ensureMoveToApplicationsPrompt(): Promise<void> {
  if (process.platform !== 'darwin' || is.dev) return
  if (app.isInApplicationsFolder()) return

  const optedOut = await settingsService.get(SKIP_KEY)
  if (optedOut === 'true') return

  const { response, checkboxChecked } = await dialog.showMessageBox({
    type: 'question',
    title: 'Move to Applications?',
    message:
      "SQL Assist works best when it's in your Applications folder. Would you like to move it now?",
    buttons: ['Move', 'Later'],
    defaultId: 0,
    cancelId: 1,
    checkboxLabel: "Don't ask again",
    checkboxChecked: false
  })

  if (response === 1) {
    if (checkboxChecked) {
      await settingsService.set(SKIP_KEY, 'true')
    }
    return
  }

  const moved = app.moveToApplicationsFolder()
  if (!moved) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Could Not Move',
      message:
        'Could not move SQL Assist to Applications. You can continue using it from its current location.'
    })
  }
}
