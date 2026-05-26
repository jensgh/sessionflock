import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import type { SessionId } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'
import { xtermTheme, type ResolvedTheme } from '../theme'

/**
 * One live xterm terminal plus its addons and host container. These objects are
 * intentionally kept OUT of React state — they are mutable, high-churn, and tied
 * to real DOM. React only ever sees session metadata (see sessionStore).
 */
export interface LiveTerminal {
  id: SessionId
  term: Terminal
  fit: FitAddon
  webgl?: WebglAddon
  container?: HTMLDivElement
  /** Per-session idle timer for the needs-input heuristic (Task 12). */
  idleTimer?: ReturnType<typeof setTimeout>
  /** Disposers for terminal-level listeners, run on dispose. */
  disposers: Array<() => void>
}

const FONT_FAMILY =
  'Menlo, Monaco, "Cascadia Code", "Source Code Pro", Consolas, "Courier New", monospace'

class Registry {
  private terminals = new Map<SessionId, LiveTerminal>()
  private currentTheme: ResolvedTheme = 'dark'

  /** Create (or return existing) live terminal for a session. */
  create(id: SessionId, opts?: { theme?: ResolvedTheme }): LiveTerminal {
    const existing = this.terminals.get(id)
    if (existing) return existing

    const theme = opts?.theme ?? this.currentTheme
    this.currentTheme = theme

    const term = new Terminal({
      scrollback: 5000,
      cursorBlink: true,
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      allowProposedApi: true,
      theme: xtermTheme(theme)
    })

    const fit = new FitAddon()
    term.loadAddon(fit)

    const disposers: Array<() => void> = []

    // Keystrokes -> main process. Typing clears any attention indicator for this
    // session (the indicator is otherwise sticky, cleared only on focus).
    const onData = term.onData((data) => {
      window.api.ptyWrite({ id, data })
      useSessionStore.getState().setAttention(id, 'none')
    })
    disposers.push(() => onData.dispose())

    // Generic fallback dot from the terminal bell (preferredNotifChannel=
    // terminal_bell). Precise 'ask'/'done' kinds arrive out-of-band from Claude
    // hooks via the main process (see App's onPtyAttention). Never flag the tab
    // you're watching; 'attention' never overrides a specific 'ask'/'done'.
    const onBell = term.onBell(() => {
      const state = useSessionStore.getState()
      const meta = state.sessions[id]
      if (!meta || meta.status !== 'running') return
      if (state.activeId === id) return
      state.setAttention(id, 'needs')
    })
    disposers.push(() => onBell.dispose())

    // Copy/paste: Ctrl+Shift+C / Ctrl+Shift+V (Linux/Windows) and Cmd+C / Cmd+V
    // (macOS). Plain Ctrl+C is left untouched so it still sends SIGINT. Tip: when
    // the app captures the mouse, hold Shift while dragging to force a selection.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      const key = e.key.toLowerCase()
      const isCopy = (e.metaKey && key === 'c') || (e.ctrlKey && e.shiftKey && key === 'c')
      const isPaste = (e.metaKey && key === 'v') || (e.ctrlKey && e.shiftKey && key === 'v')
      if (isCopy) {
        const sel = term.getSelection()
        if (sel) {
          // Electron clipboard (via IPC) — reliable, unlike navigator.clipboard
          // in a sandboxed renderer.
          window.api.writeClipboard(sel)
          return false // handled — don't forward to the pty
        }
        return true // no selection: let the key through (Ctrl+C -> SIGINT)
      }
      if (isPaste) {
        // term.paste() applies bracketed-paste wrapping when the app enabled it,
        // and routes through onData -> ptyWrite.
        void window.api.readClipboard().then((text) => {
          if (text) term.paste(text)
        })
        return false
      }
      return true
    })

    // Terminal title -> auto-name (Task 11). The store ignores this when the
    // user has manually renamed the tab.
    const onTitle = term.onTitleChange((title) => {
      useSessionStore.getState().setAutoName(id, title)
    })
    disposers.push(() => onTitle.dispose())

    const live: LiveTerminal = { id, term, fit, disposers }
    this.terminals.set(id, live)
    return live
  }

  get(id: SessionId): LiveTerminal | undefined {
    return this.terminals.get(id)
  }

  has(id: SessionId): boolean {
    return this.terminals.has(id)
  }

  /** Write pty output (or local messages) into the terminal buffer. */
  write(id: SessionId, data: string): void {
    this.terminals.get(id)?.term.write(data)
  }

  /**
   * Attach the terminal to a host element exactly once. WebGL rendering is
   * attempted but can fail on some Linux GPUs — fall back to the default
   * (canvas/DOM) renderer gracefully.
   */
  open(id: SessionId, el: HTMLDivElement): void {
    const live = this.terminals.get(id)
    if (!live) return
    if (live.container === el) {
      this.fit(id)
      return
    }
    live.container = el
    live.term.open(el)

    if (!live.webgl) {
      try {
        const webgl = new WebglAddon()
        webgl.onContextLoss(() => {
          // GPU context was lost — drop the addon and let xterm fall back.
          try {
            webgl.dispose()
          } catch {
            /* ignore */
          }
          live.webgl = undefined
        })
        live.term.loadAddon(webgl)
        live.webgl = webgl
      } catch {
        // WebGL unavailable — the default renderer stays in place.
        live.webgl = undefined
      }
    }

    this.fit(id)
  }

  /** Refit the terminal to its container. Safe to call when not yet open. */
  fit(id: SessionId): void {
    const live = this.terminals.get(id)
    if (!live || !live.container) return
    try {
      live.fit.fit()
    } catch {
      // Container may be display:none / zero-size; ignore until next fit.
    }
  }

  /** Update the rendered theme for all live terminals. */
  setTheme(resolved: ResolvedTheme): void {
    this.currentTheme = resolved
    const theme = xtermTheme(resolved)
    for (const live of this.terminals.values()) {
      live.term.options.theme = theme
    }
  }

  focus(id: SessionId): void {
    this.terminals.get(id)?.term.focus()
  }

  dispose(id: SessionId): void {
    const live = this.terminals.get(id)
    if (!live) return
    if (live.idleTimer) {
      clearTimeout(live.idleTimer)
      live.idleTimer = undefined
    }
    for (const dispose of live.disposers) {
      try {
        dispose()
      } catch {
        /* ignore */
      }
    }
    try {
      live.webgl?.dispose()
    } catch {
      /* ignore */
    }
    try {
      live.term.dispose()
    } catch {
      /* ignore */
    }
    this.terminals.delete(id)
  }

  disposeAll(): void {
    for (const id of [...this.terminals.keys()]) this.dispose(id)
  }
}

/** App-wide singleton. */
export const TerminalRegistry = new Registry()
