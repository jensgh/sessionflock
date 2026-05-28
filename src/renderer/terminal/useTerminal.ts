import { useEffect, type RefObject } from 'react'
import type { SessionId } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'
import { TerminalRegistry } from './TerminalRegistry'
import { resolveTheme } from '../theme'

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24
const RESIZE_DEBOUNCE_MS = 100

/**
 * Reset the per-session idle timer used by the needs-input heuristic (Task 12).
 * Called on every chunk of pty output. When the terminal goes quiet for
 * `idleMs`, a backgrounded session is flagged as needing input. Timers live in
 * the registry (non-React); we only flip the store boolean on edge transitions.
 */
export function scheduleNeedsInput(id: SessionId, idleMs: number): void {
  const live = TerminalRegistry.get(id)
  if (!live) return
  if (live.idleTimer) clearTimeout(live.idleTimer)
  // idleMs <= 0 disables the idle fallback entirely — rely on the bell only.
  if (idleMs <= 0) return
  live.idleTimer = setTimeout(() => {
    live.idleTimer = undefined
    const state = useSessionStore.getState()
    const meta = state.sessions[id]
    // Only flag if the session still exists, is running, and is not focused.
    if (!meta || meta.status !== 'running') return
    if (state.activeId === id) return
    state.setAttention(id, 'needs')
  }, idleMs)
}

/** Read the current pty grid size from a (fitted) terminal, with fallbacks. */
function readGrid(id: SessionId): { cols: number; rows: number } {
  const live = TerminalRegistry.get(id)
  const cols = live?.term.cols || DEFAULT_COLS
  const rows = live?.term.rows || DEFAULT_ROWS
  return { cols, rows }
}

export interface CreateSessionInput {
  cwd: string
  /** Restore path: provide a pre-minted id + name to recreate a saved tab. */
  id?: SessionId
  name?: string
  isManualName?: boolean
  order?: number
  /** Whether to focus the new session after creation. */
  activate?: boolean
  /** Task name → git worktree branch (when a worktree is created). */
  branch?: string
  /** Whether to run this session in a fresh git worktree. */
  useWorktree?: boolean
  /** Agent to launch for this session; falls back to the default agent. */
  agentId?: string
  theme: 'system' | 'light' | 'dark'
}

/**
 * Full session-create flow, reused by "New Session" and session restore:
 *   mint id -> add to store (status 'starting') -> create + open the registry
 *   terminal into its hidden div -> measure cols/rows after fit() ->
 *   ptyCreate -> on ok set 'running', else surface the error in red + 'exited'.
 *
 * NOTE (restore): recreated sessions spawn a FRESH `claude` process in the saved
 * cwd. Live process state from a previous run is NOT resumed — only the tab,
 * name, order and cwd are restored.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionId> {
  const id = input.id ?? crypto.randomUUID()
  const store = useSessionStore.getState()
  const fallbackName = input.name ?? deriveNameFromCwd(input.cwd)

  store.addSession({
    id,
    cwd: input.cwd,
    name: fallbackName,
    isManualName: input.isManualName ?? false,
    agentId: input.agentId,
    order: input.order,
    status: 'starting'
  })

  if (input.activate ?? true) store.setActive(id)

  // Build the live terminal now; TerminalPane will open() it into the hidden
  // per-session div on its first render. We give it a moment to attach so fit()
  // can measure a real grid before we create the pty.
  TerminalRegistry.create(id, { theme: resolveTheme(input.theme) })

  // Wait for the pane to mount + open the terminal so we measure a real size.
  await waitForOpen(id)
  TerminalRegistry.fit(id)
  const { cols, rows } = readGrid(id)

  try {
    const res = await window.api.ptyCreate({
      id,
      cwd: input.cwd,
      cols,
      rows,
      branch: input.branch,
      useWorktree: input.useWorktree,
      agentId: input.agentId
    })
    if (res.ok) {
      useSessionStore.getState().setStatus(id, 'running')
    } else {
      TerminalRegistry.write(
        id,
        `\r\n\x1b[31mFailed to start session: ${res.message}\x1b[0m\r\n`
      )
      useSessionStore.getState().setStatus(id, 'exited')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    TerminalRegistry.write(
      id,
      `\r\n\x1b[31mFailed to start session: ${message}\x1b[0m\r\n`
    )
    useSessionStore.getState().setStatus(id, 'exited')
  }

  return id
}

/** Poll briefly until the terminal has been opened into a container. */
function waitForOpen(id: SessionId, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const check = (): void => {
      const live = TerminalRegistry.get(id)
      if (live?.container || performance.now() - start > timeoutMs) {
        resolve()
        return
      }
      requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
}

function deriveNameFromCwd(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || cwd || 'session'
}

/**
 * React hook for a per-session terminal host. Ensures the registry terminal is
 * opened into `containerRef`, installs a debounced ResizeObserver that fits the
 * terminal and notifies the main process of the new grid size, and refits when
 * the session becomes active (its container toggles from display:none).
 */
export function useTerminal(
  id: SessionId,
  containerRef: RefObject<HTMLDivElement>,
  isActive: boolean
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // create() is idempotent; the session-create flow usually made it already.
    TerminalRegistry.create(id)
    TerminalRegistry.open(id, el)

    let timer: ReturnType<typeof setTimeout> | undefined
    const doResize = (): void => {
      TerminalRegistry.fit(id)
      const live = TerminalRegistry.get(id)
      if (!live) return
      window.api.ptyResize({ id, cols: live.term.cols, rows: live.term.rows })
    }

    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(doResize, RESIZE_DEBOUNCE_MS)
    })
    observer.observe(el)

    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
      // Terminal itself is NOT disposed here — it must survive tab switches and
      // component unmounts. Disposal happens explicitly on session close.
    }
  }, [id, containerRef])

  // When this session becomes active its div flips to display:block; refit and
  // focus so the freshly-visible terminal matches the pane size.
  useEffect(() => {
    if (!isActive) return
    const raf = requestAnimationFrame(() => {
      TerminalRegistry.fit(id)
      const live = TerminalRegistry.get(id)
      if (live) {
        window.api.ptyResize({ id, cols: live.term.cols, rows: live.term.rows })
      }
      TerminalRegistry.focus(id)
    })
    return () => cancelAnimationFrame(raf)
  }, [id, isActive])
}
