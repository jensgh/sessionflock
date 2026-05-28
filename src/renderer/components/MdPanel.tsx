import { useCallback, useEffect, useState } from 'react'
import type { MdFile } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'

/**
 * Optional right-side panel listing the markdown files under the active session's
 * folder (Phase 2 "Show MD files"). Read-only discovery: clicking a file opens it
 * in the OS default app. Toggled from the top bar; nothing is persisted.
 */
export function MdPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const cwd = useSessionStore((s) => (s.activeId ? s.sessions[s.activeId]?.cwd : undefined))
  const [files, setFiles] = useState<MdFile[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback((dir: string | undefined): void => {
    if (!dir) {
      setFiles([])
      return
    }
    setLoading(true)
    void window.api.listMarkdownFiles(dir).then((list) => {
      setFiles(list)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refresh(cwd)
  }, [cwd, refresh])

  return (
    <aside className="md-panel">
      <div className="md-panel-head">
        <span className="md-panel-title">Markdown files</span>
        <div className="md-panel-actions">
          <button
            type="button"
            className="btn btn-icon"
            title="Refresh"
            aria-label="Refresh markdown list"
            onClick={() => refresh(cwd)}
          >
            <span aria-hidden="true">⟳</span>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            title="Hide panel"
            aria-label="Hide markdown panel"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      {!cwd ? (
        <p className="md-panel-empty">No active session.</p>
      ) : loading ? (
        <p className="md-panel-empty">Scanning…</p>
      ) : files.length === 0 ? (
        <p className="md-panel-empty">No markdown files found.</p>
      ) : (
        <ul className="md-panel-list">
          {files.map((f) => (
            <li key={f.abs}>
              <button
                type="button"
                className="md-file"
                title={`Open ${f.rel}`}
                onClick={() => window.api.openPath(f.abs)}
              >
                {f.rel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
