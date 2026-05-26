// Native dialog helpers. Kept tiny so the IPC layer stays declarative.

import { BrowserWindow, dialog } from 'electron'

/**
 * Open an OS folder picker. Resolves to the chosen absolute path, or null if
 * the user cancelled.
 */
export async function pickFolder(
  win: BrowserWindow,
  defaultPath?: string
): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}
