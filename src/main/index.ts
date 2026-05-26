// Electron main entry. Creates the window, wires IPC, and guarantees no claude
// PTYs are left orphaned across quit, window close, or renderer crashes
// (including dev hot-reload).

import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createPtyManager, type PtyManager } from './ptyManager.js'
import { registerIpc } from './ipc/registerIpc.js'

// ESM has no __dirname; derive it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url))

// Linux dev convenience: Chromium's setuid sandbox needs a root-owned
// chrome-sandbox binary (mode 4755), which is rarely configured in dev or
// containers. Disable the OS sandbox in dev only — packaged builds keep it.
if (!app.isPackaged) {
  app.commandLine.appendSwitch('no-sandbox')
}

// Escape hatch for headless/container environments with no usable GPU
// (the GPU process crashes fatally). Set SFLOCK_DISABLE_GPU=1 to run there;
// leave it unset on a normal desktop so WebGL terminal rendering works.
if (process.env.SFLOCK_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
}

let mainWindow: BrowserWindow | null = null
let ptyManager: PtyManager | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      // electron-vite emits the preload as ESM (.mjs) because package.json sets
      // "type": "module"; the file lives at out/preload/index.mjs relative to
      // out/main/index.js. sandbox:false is required for an ESM preload.
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindow = win

  // PTY manager pushes data/exit to this window; guard against a destroyed
  // window (e.g. mid-teardown bursts).
  ptyManager = createPtyManager((channel, payload) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  })

  registerIpc(win, ptyManager)

  win.once('ready-to-show', () => win.show())

  // Block in-app attempts to open new browser windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // --- Lifecycle cleanup: never orphan claude processes. ---------------------
  win.on('closed', () => {
    ptyManager?.killAll()
    mainWindow = null
  })
  win.webContents.on('destroyed', () => ptyManager?.killAll())
  win.webContents.on('render-process-gone', () => ptyManager?.killAll())

  // Load the renderer: dev server URL if electron-vite provides it, else the
  // built HTML file.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked and none are open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Standard: quit on non-macOS when all windows are closed.
  if (process.platform !== 'darwin') app.quit()
})

// Final safety net before the process exits.
app.on('before-quit', () => {
  ptyManager?.killAll()
})
