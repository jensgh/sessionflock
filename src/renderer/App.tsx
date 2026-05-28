import { useEffect, useRef, useState } from 'react'
import type {
  PersistedSession,
  SessionSnapshot
} from '@shared/ipc-types'
import { SettingsProvider, useSettings } from './settings/SettingsContext'
import { useSessionStore } from './store/sessionStore'
import { TerminalRegistry } from './terminal/TerminalRegistry'
import { createSession, scheduleNeedsInput } from './terminal/useTerminal'
import { TopBar } from './components/TopBar'
import { TabRail } from './components/TabRail'
import { TerminalPane } from './components/TerminalPane'
import { SearchOverlay } from './components/SearchOverlay'
import { SessionPanel, type PanelKind } from './components/SessionPanel'
import { RightTabs } from './components/RightTabs'

const PERSIST_DEBOUNCE_MS = 500

/**
 * Fire an OS notification for a backgrounded session that wants attention.
 * Clicking it brings the window forward and focuses that session. Best-effort:
 * silently does nothing if the platform/Notification API is unavailable.
 */
function notifySession(id: string, name: string, kind: 'ask' | 'done'): void {
  if (typeof Notification === 'undefined') return
  const body = kind === 'done' ? 'Finished its turn.' : 'Needs your input.'
  try {
    const n = new Notification(name || 'Session', { body, tag: id })
    n.onclick = () => {
      window.api.focusWindow()
      useSessionStore.getState().setActive(id)
    }
  } catch {
    // Some platforms throw without notification permission — ignore.
  }
}

export function App(): JSX.Element {
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  )
}

function AppShell(): JSX.Element {
  const { settings } = useSettings()
  // Keep the latest idle threshold available to the (long-lived) data handler
  // without re-subscribing it on every settings change.
  const [searchOpen, setSearchOpen] = useState(false)
  const [rightPanel, setRightPanel] = useState<PanelKind | 'none'>('none')
  const idleMsRef = useRef(settings?.needsInputIdleMs ?? 1500)
  const notifyRef = useRef(settings?.desktopNotifications ?? true)
  const autoNameRef = useRef(settings?.autoNameSessions ?? true)

  // Ctrl/Cmd+Shift+F opens cross-session search. Capture-phase + stopPropagation
  // so the chord doesn't also get forwarded into the focused terminal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault()
        e.stopPropagation()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [])
  useEffect(() => {
    if (settings) {
      idleMsRef.current = settings.needsInputIdleMs
      notifyRef.current = settings.desktopNotifications
      autoNameRef.current = settings.autoNameSessions
    }
  }, [settings])

  // ---- Global pty data / exit handlers (registered exactly once) ----------
  useEffect(() => {
    const offData = window.api.onPtyData(({ id, data }) => {
      // Live output: write into the (possibly hidden) terminal buffer, mark
      // activity (clears needs-input), and (re)arm the idle timer (Task 12).
      TerminalRegistry.write(id, data)
      useSessionStore.getState().markActivity(id)
      scheduleNeedsInput(id, idleMsRef.current)
    })

    // Attention from Claude hooks (via the main-process event watcher). Both
    // 'done' (turn ended) and 'ask' (notification) collapse to a single
    // "needs you" state. Never flag the tab you're watching.
    const offAttention = window.api.onPtyAttention(({ id, kind }) => {
      const state = useSessionStore.getState()
      const meta = state.sessions[id]
      if (!meta || meta.status !== 'running') return
      if (state.activeId === id) return
      // Precise signal from the hook: 'done' (green) or 'ask' (amber).
      state.setAttention(id, kind)
      // Desktop notification only when the app isn't focused — when it is, the
      // in-app tab dot is enough and an OS popup would be noise.
      if (notifyRef.current && !document.hasFocus()) {
        notifySession(id, meta.name, kind)
      }
    })

    // Per-session token usage, polled from the agent transcript in main.
    const offStats = window.api.onPtyStats(({ id, contextTokens, contextWindow, model }) => {
      useSessionStore.getState().setStats(id, { contextTokens, contextWindow, model })
    })

    // First prompt → auto-name the tab (unless disabled or manually named).
    const offFirstPrompt = window.api.onPtyFirstPrompt(({ id, prompt }) => {
      if (!autoNameRef.current) return
      const meta = useSessionStore.getState().sessions[id]
      if (!meta || meta.isManualName || meta.autoNamedFromIntent) return
      void window.api.deriveSessionName(prompt).then((name) => {
        if (!name) return
        // Re-check: the user may have renamed it during the async call.
        const m = useSessionStore.getState().sessions[id]
        if (!m || m.isManualName || m.autoNamedFromIntent) return
        useSessionStore.getState().applyIntentName(id, name)
      })
    })

    const offExit = window.api.onPtyExit(({ id, exitCode, signal }) => {
      const live = TerminalRegistry.get(id)
      if (live?.idleTimer) {
        clearTimeout(live.idleTimer)
        live.idleTimer = undefined
      }
      const store = useSessionStore.getState()
      store.setStatus(id, 'exited')
      store.setAttention(id, 'none')
      const detail =
        typeof signal === 'number' && signal !== 0
          ? `signal ${signal}`
          : `code ${exitCode}`
      TerminalRegistry.write(
        id,
        `\r\n\x1b[90m[process exited — ${detail}]\x1b[0m\r\n`
      )
    })

    return () => {
      offData()
      offAttention()
      offStats()
      offFirstPrompt()
      offExit()
    }
  }, [])

  // ---- Session restore (Task 13, UI side) ---------------------------------
  // Runs once, after settings are available (we need a theme for the terminal).
  const restoredRef = useRef(false)
  useEffect(() => {
    if (!settings || restoredRef.current) return
    restoredRef.current = true

    let cancelled = false
    void (async () => {
      const snapshot = await window.api.loadSessions()
      if (cancelled) return

      // Restore in saved order. Each recreated tab spawns a FRESH `claude`
      // process in its saved cwd — live process state is NOT resumed.
      const ordered = [...snapshot.sessions].sort((a, b) => a.order - b.order)
      for (const persisted of ordered) {
        try {
          await createSession({
            id: persisted.id,
            cwd: persisted.cwd,
            name: persisted.name,
            isManualName: persisted.isManualName,
            autoNamedFromIntent: persisted.autoNamedFromIntent,
            agentId: persisted.agentId,
            order: persisted.order,
            // Don't steal focus per-tab during restore; we set activeId below.
            activate: false,
            theme: settings.theme
          })
        } catch {
          // If a tab fails to create (e.g. its cwd no longer exists), skip it.
          continue
        }
      }

      if (cancelled) return
      // Restore the previously-active tab if it still exists.
      const store = useSessionStore.getState()
      if (snapshot.activeId && store.sessions[snapshot.activeId]) {
        store.setActive(snapshot.activeId)
      } else if (store.order.length > 0) {
        store.setActive(store.order[0])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [settings])

  // ---- Persist on change (Task 13), debounced -----------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const buildSnapshot = (): SessionSnapshot => {
      const state = useSessionStore.getState()
      const sessions: PersistedSession[] = state.order
        .map((id, idx): PersistedSession | null => {
          const meta = state.sessions[id]
          if (!meta) return null
          return {
            id: meta.id,
            cwd: meta.cwd,
            name: meta.name,
            isManualName: meta.isManualName,
            autoNamedFromIntent: meta.autoNamedFromIntent,
            agentId: meta.agentId,
            order: idx
          }
        })
        .filter((s): s is PersistedSession => s !== null)
      return { version: 1, activeId: state.activeId, sessions }
    }

    const persistNow = (): void => {
      void window.api.saveSessions(buildSnapshot())
    }

    const schedulePersist = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS)
    }

    // Subscribe to just the persistence-relevant slice; high-frequency activity
    // fields (lastActivityAt/needsInput/status) are intentionally excluded so
    // typing/output does not churn disk writes.
    const unsubscribe = useSessionStore.subscribe(
      (s) => ({
        order: s.order,
        activeId: s.activeId,
        // Stable signature of names/manual-flags/cwd across all sessions.
        sig: s.order
          .map((id) => {
            const m = s.sessions[id]
            return m ? `${id}:${m.name}:${m.isManualName ? 1 : 0}:${m.cwd}` : id
          })
          .join('|')
      }),
      schedulePersist,
      {
        equalityFn: (a, b) =>
          a.activeId === b.activeId &&
          a.sig === b.sig &&
          a.order.length === b.order.length &&
          a.order.every((id, i) => id === b.order[i])
      }
    )

    // Flush synchronously when the window is closing.
    const onBeforeUnload = (): void => {
      if (timer) clearTimeout(timer)
      persistNow()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  return (
    <div className="app-root">
      <TopBar onOpenSearch={() => setSearchOpen(true)} />
      <div className="app-body">
        <TabRail />
        <TerminalPane />
        {rightPanel !== 'none' && (
          <SessionPanel kind={rightPanel} onClose={() => setRightPanel('none')} />
        )}
        <RightTabs
          active={rightPanel}
          onToggle={(kind) => setRightPanel((cur) => (cur === kind ? 'none' : kind))}
        />
      </div>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
