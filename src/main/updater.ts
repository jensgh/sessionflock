// Auto-update against the public GitHub Releases (electron-updater reads the
// publish config baked in by electron-builder). Only active in packaged builds.
//
// Linux (AppImage) / Windows: download in the background and offer to restart.
// macOS: auto-install requires a signed build, so we only notify and link to the
// releases page until code-signing is set up.

import { app, BrowserWindow, dialog, shell } from 'electron'
import updaterPkg from 'electron-updater'

const RELEASES_URL = 'https://github.com/jensgh/sessionflock/releases/latest'

export function initAutoUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) return // dev has no app-update.yml; nothing to check

  // Access lazily (the getter instantiates against the Electron app).
  const { autoUpdater } = updaterPkg

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err instanceof Error ? err.message : String(err))
  })

  if (process.platform === 'darwin') {
    autoUpdater.autoDownload = false
    autoUpdater.on('update-available', (info) => {
      void dialog
        .showMessageBox(win, {
          type: 'info',
          title: 'Update available',
          message: `Sessionflock ${info.version} is available.`,
          detail:
            'Automatic install needs a signed build on macOS. Open the releases page to download the latest version.',
          buttons: ['Open Releases', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        .then((r) => {
          if (r.response === 0) void shell.openExternal(RELEASES_URL)
        })
    })
  } else {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-downloaded', (info) => {
      void dialog
        .showMessageBox(win, {
          type: 'info',
          title: 'Update ready',
          message: `Sessionflock ${info.version} has been downloaded.`,
          detail: 'Restart now to install the update?',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        .then((r) => {
          if (r.response === 0) autoUpdater.quitAndInstall()
        })
    })
  }

  void autoUpdater.checkForUpdates().catch((e) => {
    console.error('[updater] check failed:', e instanceof Error ? e.message : String(e))
  })
}
