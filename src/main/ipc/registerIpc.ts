// Wires every IPC channel from the contract to its main-process handler.
// invoke/handle for request/response; on for high-frequency one-way sends
// (keystrokes via PTY_WRITE, and PTY_RESIZE which the preload sends, not
// invokes — see preload/index.ts).

import { BrowserWindow, clipboard, ipcMain, shell } from 'electron'
import {
  IPC,
  type AppSettings,
  type PtyCreateRequest,
  type PtyKillPayload,
  type PtyResizePayload,
  type PtyWritePayload,
  type SessionSnapshot
} from '@shared/ipc-types'
import type { PtyManager } from '../ptyManager.js'
import { pickFolder } from '../dialogs.js'
import { getSettings, setSettings } from '../settings/settingsStore.js'
import { loadSnapshot, saveSnapshot } from '../persistence/sessionStore.js'

export function registerIpc(win: BrowserWindow, ptyManager: PtyManager): void {
  // --- PTY lifecycle ---------------------------------------------------------
  ipcMain.handle(IPC.PTY_CREATE, (_e, req: PtyCreateRequest) =>
    ptyManager.createPty(req)
  )

  ipcMain.on(IPC.PTY_WRITE, (_e, p: PtyWritePayload) => {
    ptyManager.write(p.id, p.data)
  })

  // One-way send (not invoke) per the preload contract.
  ipcMain.on(IPC.PTY_RESIZE, (_e, p: PtyResizePayload) => {
    ptyManager.resize(p.id, p.cols, p.rows)
  })

  ipcMain.handle(IPC.PTY_KILL, (_e, p: PtyKillPayload) => {
    ptyManager.kill(p.id)
  })

  // --- Settings --------------------------------------------------------------
  ipcMain.handle(IPC.SETTINGS_GET, (): AppSettings => getSettings())

  ipcMain.handle(IPC.SETTINGS_SET, (_e, patch: Partial<AppSettings>): AppSettings =>
    setSettings(patch)
  )

  // --- Dialogs ---------------------------------------------------------------
  ipcMain.handle(IPC.DIALOG_PICK_FOLDER, (_e, defaultPath?: string) =>
    pickFolder(win, defaultPath)
  )

  // --- Session persistence ---------------------------------------------------
  ipcMain.handle(IPC.SESSIONS_LOAD, (): SessionSnapshot => loadSnapshot())

  ipcMain.handle(IPC.SESSIONS_SAVE, (_e, snapshot: SessionSnapshot) => {
    saveSnapshot(snapshot)
  })

  // --- Clipboard (via Electron, reliable across platforms) -------------------
  ipcMain.on(IPC.CLIPBOARD_WRITE, (_e, text: string) => {
    if (typeof text === 'string' && text.length > 0) clipboard.writeText(text)
  })

  ipcMain.handle(IPC.CLIPBOARD_READ, (): string => clipboard.readText())

  // --- Open external links ---------------------------------------------------
  // The renderer hands us URLs clicked in a terminal. Only ever open http/https:
  // terminal output is untrusted, so we must not pass file:/javascript:/etc. to
  // the OS handler.
  ipcMain.on(IPC.OPEN_EXTERNAL, (_e, url: string) => {
    if (typeof url !== 'string') return
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return // not a valid absolute URL
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      void shell.openExternal(parsed.toString())
    }
  })
}
