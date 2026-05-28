import { useEffect, useMemo, useRef, useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { TerminalRegistry } from '../terminal/TerminalRegistry'
import { agentIcon } from '../agents/icons'

interface SearchResult {
  id: string
  name: string
  agentId: string
  titleMatch: boolean
  /** Number of matches in the terminal scrollback. */
  contentMatches: number
  /** First matching scrollback line (trimmed), for a preview. */
  snippet: string | null
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    count++
    i = haystack.indexOf(needle, i + needle.length)
  }
  return count
}

/**
 * Cross-session search (Phase 2). Searches session titles and each terminal's
 * scrollback for the query; clicking a result activates that session. Read-only
 * over the live terminals via TerminalRegistry.getText — no new state to persist.
 */
export function SearchOverlay({ onClose }: { onClose: () => void }): JSX.Element {
  const [query, setQuery] = useState('')
  const order = useSessionStore((s) => s.order)
  const sessions = useSessionStore((s) => s.sessions)
  const setActive = useSessionStore((s) => s.setActive)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: SearchResult[] = []
    for (const id of order) {
      const meta = sessions[id]
      if (!meta) continue
      const titleMatch = meta.name.toLowerCase().includes(q)
      const text = TerminalRegistry.getText(id).toLowerCase()
      const contentMatches = countOccurrences(text, q)
      if (!titleMatch && contentMatches === 0) continue
      let snippet: string | null = null
      if (contentMatches > 0) {
        const line = text.split('\n').find((l) => l.includes(q))
        if (line) snippet = line.trim().slice(0, 120)
      }
      out.push({ id, name: meta.name, agentId: meta.agentId, titleMatch, contentMatches, snippet })
    }
    return out
  }, [query, order, sessions])

  const choose = (id: string): void => {
    setActive(id)
    onClose()
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search sessions"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="field-input search-input"
          type="text"
          placeholder="Search session names and output…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
        />

        <div className="search-results">
          {query.trim() && results.length === 0 && (
            <p className="search-empty">No matches.</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="search-result"
              onClick={() => choose(r.id)}
            >
              <img className="search-result-icon" src={agentIcon(r.agentId)} alt="" draggable={false} />
              <span className="search-result-main">
                <span className="search-result-name">{r.name}</span>
                {r.snippet && <span className="search-result-snippet">{r.snippet}</span>}
              </span>
              <span className="search-result-meta">
                {r.titleMatch && <span className="search-badge">name</span>}
                {r.contentMatches > 0 && (
                  <span className="search-badge">
                    {r.contentMatches} in output
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
