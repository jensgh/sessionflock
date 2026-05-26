import { useEffect, useRef, useState } from 'react'
import type { SessionId } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'

interface TabItemProps {
  id: SessionId
  onRequestClose: (id: SessionId) => void
}

/**
 * One row in the tab rail. Renders active/inactive state, the session name, a
 * "needs input" dot for backgrounded sessions (Task 12), a hover X to close
 * (Task 9), and an inline rename input on double-click (Task 11).
 */
export function TabItem({ id, onRequestClose }: TabItemProps): JSX.Element | null {
  // Subscribe narrowly to just this session's meta so other sessions' activity
  // updates don't re-render this row.
  const meta = useSessionStore((s) => s.sessions[id])
  const isActive = useSessionStore((s) => s.activeId === id)
  const setActive = useSessionStore((s) => s.setActive)
  const renameSession = useSessionStore((s) => s.renameSession)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (!meta) return null

  // The active tab never shows an indicator (you're already looking at it).
  const needsAttention = !isActive && meta.attention === 'needs'

  const beginEdit = (): void => {
    setDraft(meta.name)
    setEditing(true)
  }

  const commitEdit = (): void => {
    const trimmed = draft.trim()
    if (trimmed.length > 0) renameSession(id, trimmed)
    setEditing(false)
  }

  const cancelEdit = (): void => setEditing(false)

  const statusClass =
    meta.status === 'exited'
      ? 'tab-status-exited'
      : meta.status === 'starting'
        ? 'tab-status-starting'
        : 'tab-status-running'

  return (
    <div
      className={`tab-item${isActive ? ' tab-item-active' : ''}`}
      role="tab"
      aria-selected={isActive}
      title={meta.cwd}
      onClick={() => {
        if (!editing) setActive(id)
      }}
    >
      <span className={`tab-active-marker ${statusClass}`} aria-hidden="true">
        {isActive ? '●' : '○'}
      </span>

      {editing ? (
        <input
          ref={inputRef}
          className="tab-rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commitEdit()
            else if (e.key === 'Escape') cancelEdit()
          }}
        />
      ) : (
        <span
          className="tab-name"
          onDoubleClick={(e) => {
            e.stopPropagation()
            beginEdit()
          }}
        >
          {meta.name}
        </span>
      )}

      {!editing && needsAttention && (
        <span
          className="tab-attention"
          title="Waiting for you"
          aria-label="Waiting for you"
        />
      )}

      {!editing && (
        <button
          type="button"
          className="tab-close"
          title="Close session"
          aria-label="Close session"
          onClick={(e) => {
            e.stopPropagation()
            onRequestClose(id)
          }}
        >
          {'×'}
        </button>
      )}
    </div>
  )
}
