import { app, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { settingsService } from './services/settings.service'

const SKIP_KEY = 'skipMoveToApplicationsPrompt'

export async function ensureMoveToApplicationsPrompt(): Promise<boolean> {
  if (process.platform !== 'darwin' || is.dev) return false
  if (app.isInApplicationsFolder()) return false

  const optedOut = await settingsService.get(SKIP_KEY)
  if (optedOut === 'true') return false

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
    return false
  }

  const isFromDmg = process.execPath.includes('/Volumes/')
  if (isFromDmg) {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Manual Move Required',
      message:
        'Please drag SQL Assist to your Applications folder manually, then reopen it from there.'
    })
    return false
  }

  const moved = app.moveToApplicationsFolder()
  if (!moved) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Could Not Move',
      message:
        'Could not move SQL Assist to Applications. You can continue using it from its current location.'
    })
    return false
  }

  app.relaunch()
  app.exit(0)
  return true
}
