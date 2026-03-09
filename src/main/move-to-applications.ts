import { app, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { settingsService } from './services/settings.service'

const SKIP_KEY = 'skipMoveToApplicationsPrompt'

export async function promptMoveToApplicationsIfNeeded(): Promise<void> {
  if (is.dev) return
  if (process.platform !== 'darwin') return
  if (app.isInApplicationsFolder()) return

  const optedOut = await settingsService.get(SKIP_KEY)
  if (optedOut === 'true') return

  const { response, checkboxChecked } = await dialog.showMessageBox({
    type: 'question',
    message: 'Move to Applications?',
    detail:
      'SQL Assist is running from outside the Applications folder. Would you like to move it to Applications for easier access?',
    buttons: ['Move to Applications', 'Move Later'],
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
    dialog.showErrorBox(
      'Could not move',
      'SQL Assist could not be moved to the Applications folder. You can drag it there manually.'
    )
  }
}
