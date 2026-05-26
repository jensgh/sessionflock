import { useRef, useState } from 'react'
import type { SessionId } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'
import { useTerminal } from '../terminal/useTerminal'
import { TerminalRegistry } from '../terminal/TerminalRegistry'

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
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const closeMenu = (): void => setMenu(null)

  const copySelection = (): void => {
    closeMenu()
    const sel = activeId ? TerminalRegistry.get(activeId)?.term.getSelection() : ''
    if (sel) window.api.writeClipboard(sel)
  }

  const paste = (): void => {
    closeMenu()
    if (!activeId) return
    void window.api.readClipboard().then((text) => {
      if (text) TerminalRegistry.get(activeId)?.term.paste(text)
    })
  }

  const hasSelection = !!(activeId && TerminalRegistry.get(activeId)?.term.hasSelection())

  return (
    <section
      className="terminal-pane"
      aria-label="Terminal"
      onContextMenu={(e) => {
        if (order.length === 0) return
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {order.length === 0 && (
        <div className="terminal-pane-empty">
          <p>No session selected.</p>
          <p className="terminal-pane-empty-hint">
            Click <strong>＋ New Session</strong> to start a session.
          </p>
        </div>
      )}
      {order.map((id) => (
        <SessionTerminal key={id} id={id} isActive={id === activeId} />
      ))}

      {menu && (
        <>
          <div
            className="context-menu-backdrop"
            onMouseDown={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault()
              closeMenu()
            }}
          />
          <ul className="context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
            <li>
              <button type="button" role="menuitem" disabled={!hasSelection} onClick={copySelection}>
                Copy
              </button>
            </li>
            <li>
              <button type="button" role="menuitem" onClick={paste}>
                Paste
              </button>
            </li>
          </ul>
        </>
      )}
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
