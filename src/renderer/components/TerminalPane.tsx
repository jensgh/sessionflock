import { useRef } from 'react'
import type { SessionId } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'
import { useTerminal } from '../terminal/useTerminal'

/**
 * Hosts the focused session's terminal. To keep background terminals LIVE
 * (still receiving buffered pty output) while showing only the active one, we
 * render one persistent host <div> per session and toggle visibility with CSS
 * `display`. A single persistent hidden div per session is more robust than
 * re-`open()`-ing one shared node when switching tabs.
 */
export function TerminalPane(): JSX.Element {
  const order = useSessionStore((s) => s.order)
  const activeId = useSessionStore((s) => s.activeId)

  return (
    <section className="terminal-pane" aria-label="Terminal">
      {order.length === 0 && (
        <div className="terminal-pane-empty">
          <p>No session selected.</p>
          <p className="terminal-pane-empty-hint">
            Click <strong>＋ New Session</strong> to start a Claude session.
          </p>
        </div>
      )}
      {order.map((id) => (
        <SessionTerminal key={id} id={id} isActive={id === activeId} />
      ))}
    </section>
  )
}

function SessionTerminal({
  id,
  isActive
}: {
  id: SessionId
  isActive: boolean
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(id, containerRef, isActive)

  return (
    <div
      className="terminal-host"
      // Hidden background terminals stay mounted & live; only display toggles.
      style={{ display: isActive ? 'block' : 'none' }}
      ref={containerRef}
      onClick={() => containerRef.current?.querySelector('textarea')?.focus()}
    />
  )
}
