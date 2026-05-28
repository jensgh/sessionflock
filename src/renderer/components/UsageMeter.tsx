import { useEffect, useRef, useState } from 'react'
import { agentLabel } from '@shared/agents'
import type { AccountUsage } from '@shared/ipc-types'
import { useSessionStore } from '../store/sessionStore'
import { agentIcon } from '../agents/icons'
import { formatTokens } from '../format'

const REFRESH_MS = 60_000 // main caches the API for 5 min; polling is cheap

/**
 * Top-bar usage indicator. Collapsed: the agent icon + the current 5-hour
 * claude.ai session usage %. Click to expand a popover with the full plan usage
 * (5h + 7d) and the active session's context fill. The 5h/7d numbers are the
 * claude.ai subscription rate-limit windows (see main/stats/accountUsage).
 */
export function UsageMeter(): JSX.Element | null {
  const meta = useSessionStore((s) => (s.activeId ? s.sessions[s.activeId] : undefined))
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState<AccountUsage | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Poll the claude.ai subscription usage so the collapsed % stays current.
  useEffect(() => {
    let cancelled = false
    const refresh = (): void => {
      void window.api.getAccountUsage().then((u) => {
        if (!cancelled) setAccount(u)
      })
    }
    refresh()
    const t = setInterval(refresh, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  // Close the popover on outside-click / Escape.
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

  // Nothing to show until we have the account usage (the headline number).
  if (!account) return null

  // Use the active session's agent for the icon, else default to Claude (the
  // plan usage is a claude.ai account figure).
  const iconAgentId = meta?.agentId ?? 'claude'
  const hasContext = !!meta && meta.contextWindow > 0
  const ctxPct = hasContext
    ? Math.min(100, Math.round((meta!.contextTokens / meta!.contextWindow) * 100))
    : 0

  return (
    <div className="usage-meter" ref={ref}>
      <button
        type="button"
        className="usage-meter-btn"
        onClick={() => setOpen((o) => !o)}
        title={`Claude — 5-hour session ${account.fiveHourPct}% used`}
        aria-label={`Claude usage: 5-hour session ${account.fiveHourPct}% used`}
      >
        <img className="usage-meter-icon" src={agentIcon(iconAgentId)} alt="" draggable={false} />
        <span className="usage-meter-pct">{account.fiveHourPct}%</span>
      </button>

      {open && (
        <div className="usage-popover" role="dialog" aria-label="Usage details">
          <div className="usage-popover-head">
            <img
              className="usage-meter-icon"
              src={agentIcon(iconAgentId)}
              alt=""
              draggable={false}
            />
            <span className="usage-popover-agent">Claude plan usage</span>
          </div>

          <div className="usage-popover-row">
            <span>5-hour session</span>
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

          {hasContext && (
            <div className="usage-plan">
              <div className="usage-plan-title">{agentLabel(meta!.agentId)} — this session</div>
              {meta!.model && (
                <div className="usage-popover-row">
                  <span>Model</span>
                  <span>{meta!.model}</span>
                </div>
              )}
              <div className="usage-popover-row">
                <span>Context</span>
                <span>
                  {formatTokens(meta!.contextTokens)} / {formatTokens(meta!.contextWindow)}
                </span>
              </div>
              <div className="usage-bar" aria-hidden="true">
                <div className="usage-bar-fill" style={{ width: `${ctxPct}%` }} />
              </div>
              <div className="usage-popover-foot">{ctxPct}% of context window used</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
