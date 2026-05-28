import { useEffect, useRef, useState } from 'react'
import { agentLabel } from '@shared/agents'
import type { AccountUsage } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'
import { agentIcon } from '../agents/icons'
import { formatTokens } from '../format'

/**
 * Top-bar usage indicator for the ACTIVE session: agent icon + context-fill %.
 * Click to expand a detail popover (model, used/window tokens, fill bar). Hidden
 * when there's no active session or its stats haven't arrived yet. All data comes
 * from the per-session stats already in the store (see sessionStore / PTY_STATS).
 */
export function UsageMeter(): JSX.Element | null {
  const meta = useSessionStore((s) => (s.activeId ? s.sessions[s.activeId] : undefined))
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState<AccountUsage | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Pull the claude.ai subscription usage (5h/7d windows) when the panel opens.
  // Main caches it for 5 min, so reopening is cheap.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void window.api.getAccountUsage().then((u) => {
      if (!cancelled) setAccount(u)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Close the popover on outside-click / Escape (mirrors the modal pattern).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Nothing useful to show until a session is active and has reported stats.
  if (!meta || meta.contextWindow <= 0) return null

  const pct = Math.min(100, Math.round((meta.contextTokens / meta.contextWindow) * 100))
  const label = agentLabel(meta.agentId)

  return (
    <div className="usage-meter" ref={ref}>
      <button
        type="button"
        className="usage-meter-btn"
        onClick={() => setOpen((o) => !o)}
        title={`${label} — context ${pct}% full`}
        aria-label={`${label} usage: context ${pct}% full`}
      >
        <img className="usage-meter-icon" src={agentIcon(meta.agentId)} alt="" draggable={false} />
        <span className="usage-meter-pct">{pct}%</span>
      </button>

      {open && (
        <div className="usage-popover" role="dialog" aria-label="Session usage">
          <div className="usage-popover-head">
            <img
              className="usage-meter-icon"
              src={agentIcon(meta.agentId)}
              alt=""
              draggable={false}
            />
            <span className="usage-popover-agent">{label}</span>
          </div>

          {meta.model && (
            <div className="usage-popover-row">
              <span>Model</span>
              <span>{meta.model}</span>
            </div>
          )}

          <div className="usage-popover-row">
            <span>Context</span>
            <span>
              {formatTokens(meta.contextTokens)} / {formatTokens(meta.contextWindow)}
            </span>
          </div>

          <div className="usage-bar" aria-hidden="true">
            <div className="usage-bar-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="usage-popover-foot">{pct}% of context window used</div>

          {account && (
            <div className="usage-plan">
              <div className="usage-plan-title">Claude plan usage</div>
              <div className="usage-popover-row">
                <span>5-hour</span>
                <span>{account.fiveHourPct}%</span>
              </div>
              <div className="usage-bar" aria-hidden="true">
                <div className="usage-bar-fill" style={{ width: `${account.fiveHourPct}%` }} />
              </div>
              <div className="usage-popover-row">
                <span>7-day</span>
                <span>{account.sevenDayPct}%</span>
              </div>
              <div className="usage-bar" aria-hidden="true">
                <div className="usage-bar-fill" style={{ width: `${account.sevenDayPct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
