// Owns every pseudoterminal in the app. UI-agnostic: it knows nothing about
// Electron beyond the injected `send` callback used to push PTY_DATA / PTY_EXIT
// to the renderer. The renderer mints session ids; this module maps each id to
// a node-pty process and brokers all I/O.

import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  watch,
  writeFileSync,
  type FSWatcher
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  IPC,
  type PtyCreateError,
  type PtyCreateRequest,
  type PtyCreateResult,
  type SessionId
} from '@shared/ipc-types'
import { getAgent } from './agents/index.js'
import { getSettings } from './settings/settingsStore.js'
import { prepareSessionCwd } from './worktree.js'

// --- Backpressure tuning -----------------------------------------------------
// Claude can emit huge bursts of output (e.g. long tool results, file dumps).
// Sending an IPC message per onData chunk floods the channel and the renderer.
// Instead we coalesce chunks per-session and flush on a short timer.
const FLUSH_INTERVAL_MS = 12
const MAX_FLUSH_BYTES = 256 * 1024 // cap a single PTY_DATA payload; split if larger

// Diagnostic: when SFLOCK_DEBUG=1, log every hook event the host reads from a
// session's event file. Reveals whether (and which) agent hooks actually fire.
const DEBUG = process.env.SFLOCK_DEBUG === '1'

// Per-session hook event files live here. An agent's hooks append marker lines
// (e.g. Claude's Stop/Notification); we watch the file and forward PTY_ATTENTION.
const EVENTS_DIR = join(tmpdir(), 'sessionflock-events')

/** Callback the host (index.ts) injects to deliver messages to the renderer. */
type SendFn = (channel: string, payload: unknown) => void

interface Session {
  pty: IPty
  /** Pending output chunks awaiting the next flush. */
  buffer: string[]
  /** Active flush timer, or null when idle. */
  timer: NodeJS.Timeout | null
  /** Path to this session's hook event file. */
  eventFile: string
  /** Watcher on the event file (null if it couldn't be established). */
  watcher: FSWatcher | null
  /** Bytes of the event file already consumed. */
  eventOffset: number
}

export class PtyManager {
  private readonly sessions = new Map<SessionId, Session>()

  constructor(private readonly send: SendFn) {}

  /** Spawn an agent PTY. Returns a result on success or an error shape. */
  createPty(req: PtyCreateRequest): PtyCreateResult | PtyCreateError {
    if (this.sessions.has(req.id)) {
      return { id: req.id, ok: false, message: `Session ${req.id} already exists.` }
    }

    if (!req.cwd || !existsSync(req.cwd)) {
      return {
        id: req.id,
        ok: false,
        message: `Folder does not exist: ${req.cwd}`
      }
    }

    const settings = getSettings()
    const agent = getAgent(settings.defaultAgent)

    let bin: string
    let args: string[]
    try {
      const launch = agent.resolveLaunch({ explicitPath: settings.claudePath })
      bin = launch.bin
      args = launch.args
    } catch (err) {
      return {
        id: req.id,
        ok: false,
        message: err instanceof Error ? err.message : String(err)
      }
    }

    // Per-session hook event file: the agent's hooks append marker lines here
    // (via $SFLOCK_EVENT_FILE) and we watch it. Created up front so the watcher has
    // something to attach to.
    const eventFile = join(EVENTS_DIR, `${req.id}.log`)
    try {
      mkdirSync(EVENTS_DIR, { recursive: true })
      writeFileSync(eventFile, '')
    } catch {
      // Non-fatal: without the file, hook attention signals are simply absent.
    }
    const env = agent.buildEnv()
    env.SFLOCK_EVENT_FILE = eventFile

    // Optionally isolate the session in a fresh git worktree (falls back to the
    // requested folder if it isn't a repo or worktree creation fails).
    const resolved = prepareSessionCwd(req.cwd, req.useWorktree ?? false, req.branch)

    let child: IPty
    try {
      child = pty.spawn(bin, args, {
        name: 'xterm-256color',
        cwd: resolved.cwd,
        cols: req.cols,
        rows: req.rows,
        env: env as { [key: string]: string }
      })
    } catch (err) {
      return {
        id: req.id,
        ok: false,
        message: `Failed to launch ${agent.label}: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    const session: Session = {
      pty: child,
      buffer: [],
      timer: null,
      eventFile,
      watcher: null,
      eventOffset: 0
    }
    this.sessions.set(req.id, session)
    this.watchEvents(req.id, session)

    child.onData((data) => {
      session.buffer.push(data)
      if (session.timer === null) {
        session.timer = setTimeout(() => this.flush(req.id), FLUSH_INTERVAL_MS)
      }
    })

    child.onExit(({ exitCode, signal }) => {
      // Flush any buffered output before announcing the exit so the renderer
      // doesn't lose the final bytes.
      this.flush(req.id)
      this.clearTimer(session)
      this.cleanupEvents(session)
      this.sessions.delete(req.id)
      this.send(IPC.PTY_EXIT, { id: req.id, exitCode, signal })
    })

    return { id: req.id, ok: true, pid: child.pid }
  }

  write(id: SessionId, data: string): void {
    const session = this.sessions.get(id)
    if (session) session.pty.write(data)
  }

  resize(id: SessionId, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (!session) return
    // node-pty throws if given non-positive dimensions; guard against the
    // transient 0x0 the renderer may emit before layout settles.
    if (cols > 0 && rows > 0) {
      try {
        session.pty.resize(cols, rows)
      } catch {
        // Ignore — a resize on a dying pty is harmless.
      }
    }
  }

  kill(id: SessionId): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.clearTimer(session)
    this.cleanupEvents(session)
    session.buffer.length = 0
    this.sessions.delete(id)
    try {
      session.pty.kill()
    } catch {
      // Process may already be gone.
    }
  }

  /** Terminate every PTY. Called on app shutdown / window teardown. */
  killAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id)
    }
  }

  /** Drain a session's buffered output to the renderer, chunked to the cap. */
  private flush(id: SessionId): void {
    const session = this.sessions.get(id)
    if (!session) return

    this.clearTimer(session)
    if (session.buffer.length === 0) return

    let combined = session.buffer.join('')
    session.buffer.length = 0

    if (combined.length <= MAX_FLUSH_BYTES) {
      this.send(IPC.PTY_DATA, { id, data: combined })
      return
    }

    // Oversized burst: split into bounded payloads to avoid a single giant IPC
    // message stalling the renderer.
    let offset = 0
    while (offset < combined.length) {
      const slice = combined.slice(offset, offset + MAX_FLUSH_BYTES)
      this.send(IPC.PTY_DATA, { id, data: slice })
      offset += MAX_FLUSH_BYTES
    }
  }

  private clearTimer(session: Session): void {
    if (session.timer !== null) {
      clearTimeout(session.timer)
      session.timer = null
    }
  }

  /** Watch a session's hook event file and forward appended markers. */
  private watchEvents(id: SessionId, session: Session): void {
    try {
      session.watcher = watch(session.eventFile, () => this.readEvents(id))
    } catch {
      // Watch may be unavailable (e.g. file missing); attention falls back to
      // the terminal bell. Not fatal.
      session.watcher = null
    }
  }

  /** Read newly-appended hook events and forward 'done'/'ask' to the renderer. */
  private readEvents(id: SessionId): void {
    const session = this.sessions.get(id)
    if (!session) return
    let content: string
    try {
      content = readFileSync(session.eventFile, 'utf8')
    } catch {
      return
    }
    if (content.length <= session.eventOffset) return
    const fresh = content.slice(session.eventOffset)
    session.eventOffset = content.length
    for (const raw of fresh.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      if (DEBUG) console.log(`[csm-debug] ${id.slice(0, 8)} event: ${line}`)
      if (line === 'done' || line === 'ask') {
        this.send(IPC.PTY_ATTENTION, { id, kind: line })
      }
    }
  }

  /** Stop watching and remove a session's event file. */
  private cleanupEvents(session: Session): void {
    if (session.watcher) {
      try {
        session.watcher.close()
      } catch {
        /* ignore */
      }
      session.watcher = null
    }
    try {
      unlinkSync(session.eventFile)
    } catch {
      /* ignore */
    }
  }
}

export function createPtyManager(send: SendFn): PtyManager {
  return new PtyManager(send)
}
