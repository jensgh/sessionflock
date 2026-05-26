import { useState } from 'react'
import { useSettings } from '../settings/SettingsContext'
import { createSession } from '../terminal/useTerminal'
import { SettingsModal } from './SettingsModal'
import { PromptModal } from './PromptModal'

/** Top bar: New Session split-button (left) and Settings (right). */
export function TopBar(): JSX.Element {
  const { settings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  // When worktree isolation is on, we prompt for a task name before creating;
  // this holds the folder we're about to start a session in.
  const [pendingCwd, setPendingCwd] = useState<string | null>(null)

  const newSession = async (cwd: string, task?: string): Promise<void> => {
    if (!settings || creating) return
    setCreating(true)
    try {
      const name = task && task.length > 0 ? task : undefined
      await createSession({
        cwd,
        theme: settings.theme,
        activate: true,
        branch: name, // → git worktree branch (when one is created)
        name, // also use the task as the tab name…
        isManualName: !!name // …and keep it from being overwritten by the agent
      })
    } finally {
      setCreating(false)
    }
  }

  // Worktree on → ask for a task name first; otherwise start immediately.
  const startSession = (cwd: string): void => {
    if (!settings) return
    if (settings.gitWorktreeByDefault) setPendingCwd(cwd)
    else void newSession(cwd)
  }

  const onNewSession = (): void => {
    if (settings) startSession(settings.defaultHomeFolder)
  }

  // Ad-hoc: pick a folder for this session only, overriding the default.
  const onNewSessionInFolder = async (): Promise<void> => {
    if (!settings) return
    const picked = await window.api.pickFolder(settings.defaultHomeFolder)
    if (picked) startSession(picked)
  }

  const disabled = !settings || creating

  return (
    <header className="top-bar">
      <div className="new-session-group">
        <button
          type="button"
          className="btn btn-primary new-session-btn"
          onClick={onNewSession}
          disabled={disabled}
          title="Start a new session in the default folder"
        >
          <span aria-hidden="true">＋</span> New Session
        </button>
        <button
          type="button"
          className="btn btn-primary new-session-folder-btn"
          onClick={() => void onNewSessionInFolder()}
          disabled={disabled}
          title="Start a new session in a different folder…"
          aria-label="Start a new session in a different folder"
        >
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      <div className="top-bar-spacer" />

      <button
        type="button"
        className="btn btn-icon settings-btn"
        onClick={() => setSettingsOpen(true)}
        title="Settings"
        aria-label="Settings"
      >
        <span aria-hidden="true">⚙</span>
      </button>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {pendingCwd !== null && (
        <PromptModal
          title="New session"
          label="What are you working on? (used for the git branch + tab name)"
          placeholder="e.g. fix login redirect"
          confirmLabel="Start"
          onSubmit={(value) => {
            const cwd = pendingCwd
            setPendingCwd(null)
            void newSession(cwd, value.trim())
          }}
          onCancel={() => setPendingCwd(null)}
        />
      )}
    </header>
  )
}
