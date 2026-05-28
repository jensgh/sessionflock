import { useCallback, useEffect, useState } from 'react'
import type { SessionResources } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'

export type PanelKind = 'md' | 'mcp' | 'skills'

const TITLE: Record<PanelKind, string> = {
  md: 'Markdown files read',
  mcp: 'MCP servers used',
  skills: 'Skills used'
}

const EMPTY_MSG: Record<PanelKind, string> = {
  md: 'No markdown files read in this session yet.',
  mcp: 'No MCP servers used in this session yet.',
  skills: 'No skills used in this session yet.'
}

/**
 * Right-side panel showing what the ACTIVE session has actually used, derived
 * from its transcript (main/stats/sessionResources): markdown files it read, MCP
 * servers whose tools it invoked, or skills it ran — selected by `kind`.
 */
export function SessionPanel({
  kind,
  onClose
}: {
  kind: PanelKind
  onClose: () => void
}): JSX.Element {
  const activeId = useSessionStore((s) => s.activeId)
  const [res, setRes] = useState<SessionResources | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback((id: string | null): void => {
    if (!id) {
      setRes(null)
      return
    }
    setLoading(true)
    void window.api.getSessionResources(id).then((r) => {
      setRes(r)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refresh(activeId)
  }, [activeId, kind, refresh])

  const mdFiles = res?.mdFiles ?? []
  const items = kind === 'mcp' ? (res?.mcpServers ?? []) : kind === 'skills' ? (res?.skills ?? []) : []
  const isEmpty = kind === 'md' ? mdFiles.length === 0 : items.length === 0

  return (
    <aside className="side-panel">
      <div className="side-panel-head">
        <span className="side-panel-title">{TITLE[kind]}</span>
        <div className="side-panel-actions">
          <button
            type="button"
            className="btn btn-icon"
            title="Refresh"
            aria-label="Refresh"
            onClick={() => refresh(activeId)}
          >
            <span aria-hidden="true">⟳</span>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            title="Hide panel"
            aria-label="Hide panel"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      {!activeId ? (
        <p className="side-panel-empty">No active session.</p>
      ) : loading && !res ? (
        <p className="side-panel-empty">Reading session…</p>
      ) : isEmpty ? (
        <p className="side-panel-empty">{EMPTY_MSG[kind]}</p>
      ) : kind === 'md' ? (
        <ul className="side-panel-list">
          {mdFiles.map((f) => (
            <li key={f.abs}>
              <button
                type="button"
                className="side-panel-item side-panel-item-clickable"
                title={`Open ${f.abs}`}
                onClick={() => window.api.openPath(f.abs)}
              >
                {f.rel}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="side-panel-list">
          {items.map((label) => (
            <li key={label}>
              <span className="side-panel-item">{label}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
