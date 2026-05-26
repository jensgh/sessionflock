import { useCallback, useState } from 'react'
import type { SessionId } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'
import { TerminalRegistry } from '../terminal/TerminalRegistry'
import { TabItem } from './TabItem'
import { ConfirmDialog } from './ConfirmDialog'

/** Vertical rail of session tabs, plus the close-confirmation flow (Task 9). */
export function TabRail(): JSX.Element {
  const order = useSessionStore((s) => s.order)
  const removeSession = useSessionStore((s) => s.removeSession)
  const [pendingClose, setPendingClose] = useState<SessionId | null>(null)

  const pendingName = useSessionStore((s) =>
    pendingClose ? s.sessions[pendingClose]?.name ?? null : null
  )

  const requestClose = useCallback((id: SessionId) => {
    setPendingClose(id)
  }, [])

  const confirmClose = useCallback(() => {
    const id = pendingClose
    if (!id) return
    setPendingClose(null)
    // Order matters: stop the process, tear down the live terminal, then drop
    // the metadata (which also reassigns the active tab to a neighbour).
    void window.api.ptyKill({ id })
    TerminalRegistry.dispose(id)
    removeSession(id)
  }, [pendingClose, removeSession])

  return (
    <nav className="tab-rail" role="tablist" aria-label="Sessions">
      {order.length === 0 ? (
        <div className="tab-rail-empty">No sessions yet.</div>
      ) : (
        order.map((id) => (
          <TabItem key={id} id={id} onRequestClose={requestClose} />
        ))
      )}

      {pendingClose && (
        <ConfirmDialog
          title="Close session"
          message={`Close "${pendingName ?? 'this session'}"? Its Claude process will be terminated.`}
          confirmLabel="Close"
          destructive
          onConfirm={confirmClose}
          onCancel={() => setPendingClose(null)}
        />
      )}
    </nav>
  )
}
