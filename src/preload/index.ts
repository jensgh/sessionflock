import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AppSettings,
  type PtyCreateRequest,
  type PtyCreateResponse,
  type PtyAttentionPayload,
  type PtyDataPayload,
  type PtyExitPayload,
  type PtyKillPayload,
  type PtyResizePayload,
  type PtyWritePayload,
  type RendererApi,
  type SessionSnapshot
} from '@shared/ipc-types'

// Thin marshaling layer only — no business logic lives here. PTYs run in the
// main process; the renderer never touches node-pty directly.
const api: RendererApi = {
  ptyCreate: (req: PtyCreateRequest): Promise<PtyCreateResponse> =>
    ipcRenderer.invoke(IPC.PTY_CREATE, req),

  ptyWrite: (payload: PtyWritePayload): void => {
    ipcRenderer.send(IPC.PTY_WRITE, payload)
  },

  ptyResize: (payload: PtyResizePayload): void => {
    ipcRenderer.send(IPC.PTY_RESIZE, payload)
  },

  ptyKill: (payload: PtyKillPayload): Promise<void> =>
    ipcRenderer.invoke(IPC.PTY_KILL, payload),

  onPtyData: (cb: (payload: PtyDataPayload) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: PtyDataPayload): void =>
      cb(payload)
    ipcRenderer.on(IPC.PTY_DATA, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_DATA, listener)
  },

  onPtyExit: (cb: (payload: PtyExitPayload) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: PtyExitPayload): void =>
      cb(payload)
    ipcRenderer.on(IPC.PTY_EXIT, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_EXIT, listener)
  },

  onPtyAttention: (cb: (payload: PtyAttentionPayload) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: PtyAttentionPayload): void =>
      cb(payload)
    ipcRenderer.on(IPC.PTY_ATTENTION, listener)
    return () => ipcRenderer.removeListener(IPC.PTY_ATTENTION, listener)
  },

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),

  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, patch),

  pickFolder: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_PICK_FOLDER, defaultPath),

  loadSessions: (): Promise<SessionSnapshot> => ipcRenderer.invoke(IPC.SESSIONS_LOAD),

  saveSessions: (snapshot: SessionSnapshot): Promise<void> =>
    ipcRenderer.invoke(IPC.SESSIONS_SAVE, snapshot)
}

contextBridge.exposeInMainWorld('api', api)
