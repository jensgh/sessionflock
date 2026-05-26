import { useEffect, useRef } from 'react'
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

const PERSIST_DEBOUNCE_MS = 500

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
  const idleMsRef = useRef(settings?.needsInputIdleMs ?? 1500)
  useEffect(() => {
    if (settings) idleMsRef.current = settings.needsInputIdleMs
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
    const offAttention = window.api.onPtyAttention(({ id }) => {
      const state = useSessionStore.getState()
      const meta = state.sessions[id]
      if (!meta || meta.status !== 'running') return
      if (state.activeId === id) return
      state.setAttention(id, 'needs')
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
        .map((id, idx) => {
          const meta = state.sessions[id]
          if (!meta) return null
          return {
            id: meta.id,
            cwd: meta.cwd,
            name: meta.name,
            isManualName: meta.isManualName,
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
      <TopBar />
      <div className="app-body">
        <TabRail />
        <TerminalPane />
      </div>
    </div>
  )
}
