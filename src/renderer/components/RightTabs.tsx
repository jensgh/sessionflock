import type { PanelKind } from './SessionPanel'

const TABS: { kind: PanelKind; glyph: string; label: string }[] = [
  { kind: 'md', glyph: '❡', label: 'Markdown files read in this session' },
  { kind: 'mcp', glyph: '⚇', label: 'MCP servers used in this session' },
  { kind: 'skills', glyph: '✦', label: 'Skills used in this session' }
]

/**
 * Thin vertical tab strip on the right edge for the session-resource panels.
 * Kept separate from the top bar (and Settings) so it reads as a view switcher.
 * Clicking the active tab closes the panel.
 */
export function RightTabs({
  active,
  onToggle
}: {
  active: PanelKind | 'none'
  onToggle: (kind: PanelKind) => void
}): JSX.Element {
  return (
    <div className="right-tabs" role="tablist" aria-orientation="vertical">
      {TABS.map((t) => (
        <button
          key={t.kind}
          type="button"
          role="tab"
          className={`right-tab${active === t.kind ? ' right-tab-active' : ''}`}
          title={t.label}
          aria-label={t.label}
          aria-selected={active === t.kind}
          onClick={() => onToggle(t.kind)}
        >
          <span aria-hidden="true">{t.glyph}</span>
        </button>
      ))}
    </div>
  )
}
