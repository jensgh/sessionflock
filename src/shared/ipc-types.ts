// Single source of truth for the IPC contract between the Electron main process
// (which owns all PTYs and on-disk state) and the renderer (which owns xterm
// instances and the UI). Imported by main, preload, and renderer.

export type SessionId = string

/** Channel names. */
export const IPC = {
  // renderer -> main (invoke/handle)
  PTY_CREATE: 'pty:create',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  DIALOG_PICK_FOLDER: 'dialog:pickFolder',
  SESSIONS_LOAD: 'sessions:load',
  SESSIONS_SAVE: 'sessions:save',
  CLIPBOARD_READ: 'clipboard:read',
  // renderer -> main (one-way send; high-frequency keystrokes)
  PTY_WRITE: 'pty:write',
  CLIPBOARD_WRITE: 'clipboard:write',
  // main -> renderer (webContents.send)
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_ATTENTION: 'pty:attention'
} as const

// ---- PTY lifecycle ----------------------------------------------------------

export interface PtyCreateRequest {
  id: SessionId
  cwd: string
  cols: number
  rows: number
  /** Optional task name; used as the git worktree branch when one is created. */
  branch?: string
}

export interface PtyCreateResult {
  id: SessionId
  ok: true
  pid: number
}

export interface PtyCreateError {
  id: SessionId
  ok: false
  message: string
}

export type PtyCreateResponse = PtyCreateResult | PtyCreateError

export interface PtyWritePayload {
  id: SessionId
  data: string
}

export interface PtyResizePayload {
  id: SessionId
  cols: number
  rows: number
}

export interface PtyKillPayload {
  id: SessionId
}

export interface PtyDataPayload {
  id: SessionId
  data: string
}

export interface PtyExitPayload {
  id: SessionId
  exitCode: number
  signal?: number
}

/** Precise attention signal from a Claude lifecycle hook (via the event file). */
export interface PtyAttentionPayload {
  id: SessionId
  /** 'done' = turn finished (green), 'ask' = waiting for input/permission (yellow). */
  kind: 'ask' | 'done'
}

// ---- Settings ---------------------------------------------------------------

export type ThemeSetting = 'system' | 'light' | 'dark'

export interface AppSettings {
  version: 1
  /** Absolute path; default cwd for new sessions. */
  defaultHomeFolder: string
  theme: ThemeSetting
  /** Idle ms before a backgrounded session is flagged "needs input". */
  needsInputIdleMs: number
  /** Which terminal agent new sessions launch (see shared/agents.ts). */
  defaultAgent: string
  /** When the session folder is a git repo, run it in a fresh git worktree. */
  gitWorktreeByDefault: boolean
  /** Explicit path to the `claude` binary; null = auto-detect. */
  claudePath: string | null
}

export const DEFAULT_SETTINGS: Omit<AppSettings, 'defaultHomeFolder'> = {
  version: 1,
  theme: 'system',
  // Idle fallback for the "needs you" dot — OFF by default. The dot should only
  // appear when something is actually needed (the agent's Stop/Notification hooks
  // or the terminal bell), never on a timer/guess. Set >0 to opt into a fallback.
  needsInputIdleMs: 0,
  defaultAgent: 'claude',
  gitWorktreeByDefault: false,
  claudePath: null
}

// ---- Session persistence ----------------------------------------------------

export interface PersistedSession {
  id: SessionId
  cwd: string
  name: string
  isManualName: boolean
  order: number
}

export interface SessionSnapshot {
  version: 1
  activeId: SessionId | null
  sessions: PersistedSession[]
}

export const EMPTY_SNAPSHOT: SessionSnapshot = {
  version: 1,
  activeId: null,
  sessions: []
}

// ---- Renderer-facing API (exposed on window.api by the preload) -------------

export interface RendererApi {
  ptyCreate(req: PtyCreateRequest): Promise<PtyCreateResponse>
  ptyWrite(payload: PtyWritePayload): void
  ptyResize(payload: PtyResizePayload): void
  ptyKill(payload: PtyKillPayload): Promise<void>
  /** Subscribe to output for all sessions; returns an unsubscribe fn. */
  onPtyData(cb: (payload: PtyDataPayload) => void): () => void
  /** Subscribe to process-exit for all sessions; returns an unsubscribe fn. */
  onPtyExit(cb: (payload: PtyExitPayload) => void): () => void
  /** Subscribe to hook-driven attention signals; returns an unsubscribe fn. */
  onPtyAttention(cb: (payload: PtyAttentionPayload) => void): () => void
  getSettings(): Promise<AppSettings>
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  /** Open the OS folder picker; resolves to the chosen path or null. */
  pickFolder(defaultPath?: string): Promise<string | null>
  loadSessions(): Promise<SessionSnapshot>
  saveSessions(snapshot: SessionSnapshot): Promise<void>
  /** Write text to the OS clipboard (via Electron's clipboard). */
  writeClipboard(text: string): void
  /** Read text from the OS clipboard. */
  readClipboard(): Promise<string>
}
