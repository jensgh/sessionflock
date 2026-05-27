import { useEffect, useState } from 'react'
import type { ThemeSetting, WorktreeMode } from '@shared/ipc-types'
import { AGENTS } from '@shared/agents'
import { useSettings } from '../settings/SettingsContext'

const MIN_IDLE_MS = 0 // 0 = idle fallback off (terminal bell only)
const MAX_IDLE_MS = 60_000

/** Settings editor (Tasks 10 + 15): default folder, theme, idle threshold. */
export function SettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { settings, updateSettings } = useSettings()

  const [defaultHomeFolder, setDefaultHomeFolder] = useState('')
  const [theme, setTheme] = useState<ThemeSetting>('system')
  const [defaultAgent, setDefaultAgent] = useState('claude')
  const [worktreeMode, setWorktreeMode] = useState<WorktreeMode>('never')
  const [askOnNewSession, setAskOnNewSession] = useState(false)
  const [needsInputIdleMs, setNeedsInputIdleMs] = useState(1500)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed the form from the loaded settings once they arrive.
  useEffect(() => {
    if (!settings) return
    setDefaultHomeFolder(settings.defaultHomeFolder)
    setTheme(settings.theme)
    setDefaultAgent(settings.defaultAgent)
    setWorktreeMode(settings.worktreeMode)
    setAskOnNewSession(settings.askOnNewSession)
    setNeedsInputIdleMs(settings.needsInputIdleMs)
  }, [settings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const browse = async (): Promise<void> => {
    const picked = await window.api.pickFolder(defaultHomeFolder || undefined)
    if (picked) setDefaultHomeFolder(picked)
  }

  const save = async (): Promise<void> => {
    setError(null)
    const folder = defaultHomeFolder.trim()
    if (folder.length === 0) {
      setError('Default folder cannot be empty.')
      return
    }
    const idle = Math.min(
      MAX_IDLE_MS,
      Math.max(MIN_IDLE_MS, Math.round(needsInputIdleMs))
    )
    setSaving(true)
    try {
      await updateSettings({
        defaultHomeFolder: folder,
        theme,
        defaultAgent,
        worktreeMode,
        askOnNewSession,
        needsInputIdleMs: idle
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">Settings</h2>

        <label className="field">
          <span className="field-label">Default folder for new sessions</span>
          <div className="field-row">
            <input
              className="field-input"
              type="text"
              value={defaultHomeFolder}
              onChange={(e) => setDefaultHomeFolder(e.target.value)}
              spellCheck={false}
            />
            <button
              type="button"
              className="btn"
              onClick={() => void browse()}
            >
              Browse…
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field-label">Theme</span>
          <select
            className="field-input"
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeSetting)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">Agent for new sessions</span>
          <select
            className="field-input"
            value={defaultAgent}
            onChange={(e) => setDefaultAgent(e.target.value)}
          >
            {AGENTS.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Which terminal agent new sessions launch. More agents coming; only
            Claude Code is available right now.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Git worktree for new sessions</span>
          <select
            className="field-input"
            value={worktreeMode}
            onChange={(e) => setWorktreeMode(e.target.value as WorktreeMode)}
          >
            <option value="never">Never</option>
            <option value="always">Always</option>
            <option value="ask">Ask each time</option>
          </select>
          <span className="field-hint">
            When the folder is a git repository, run the session in a fresh
            worktree (a clean checkout on a new branch) so parallel sessions don’t
            collide. “Ask each time” prompts on each new session. Changes stay on
            their branch; worktrees aren’t removed automatically.
          </span>
        </label>

        <label className="field">
          <span className="field-label">
            <input
              type="checkbox"
              checked={askOnNewSession}
              onChange={(e) => setAskOnNewSession(e.target.checked)}
            />{' '}
            Ask on new session what I’m working on
          </span>
          <span className="field-hint">
            Prompt for a short task name when starting a session; it names the tab
            and (with worktree isolation on) the git branch. Off = start
            immediately.
          </span>
        </label>

        <label className="field">
          <span className="field-label">
            Needs-input idle fallback (ms, 0 = off)
          </span>
          <input
            className="field-input"
            type="number"
            min={MIN_IDLE_MS}
            max={MAX_IDLE_MS}
            step={100}
            value={needsInputIdleMs}
            onChange={(e) => setNeedsInputIdleMs(Number(e.target.value))}
          />
          <span className="field-hint">
            A background session is flagged “needs you” instantly when Claude’s
            hooks or the terminal bell fire, and — as a fallback — after this many
            ms of silence. 0 = off (rely on hooks/bell only).
          </span>
        </label>

        {error && <p className="settings-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saving || !settings}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
