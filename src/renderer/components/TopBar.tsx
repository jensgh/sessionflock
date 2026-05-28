import { useState } from 'react'
import { useSettings } from '../settings/SettingsContext'
import { createSession } from '../terminal/useTerminal'
import { SettingsModal } from './SettingsModal'
import { PromptModal } from './PromptModal'
import { UsageMeter } from './UsageMeter'

/** Top bar: New Session split-button (left), usage meter + search + Settings (right). */
export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }): JSX.Element {
  const { settings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  // When a prompt is needed before starting, this holds the target folder and
  // whether to offer the worktree toggle (worktree mode = "ask").
  const [pending, setPending] = useState<{ cwd: string; showWorktree: boolean } | null>(null)

  const newSession = async (cwd: string, task: string, useWorktree: boolean): Promise<void> => {
    if (!settings || creating) return
    setCreating(true)
    try {
      const name = task.length > 0 ? task : undefined
      await createSession({
        cwd,
        theme: settings.theme,
        activate: true,
        useWorktree,
        agentId: settings.defaultAgent,
        branch: name, // → git worktree branch (when one is created)
        name, // also use the task as the tab name…
        isManualName: !!name // …kept from being overwritten by the agent
      })
    } finally {
      setCreating(false)
    }
  }

  // Decide whether to prompt, based on worktree mode + the "ask" setting.
  const startSession = (cwd: string): void => {
    if (!settings) return
    const mode = settings.worktreeMode
    const needDialog = settings.askOnNewSession || mode === 'ask'
    if (needDialog) {
      setPending({ cwd, showWorktree: mode === 'ask' })
    } else {
      void newSession(cwd, '', mode === 'always')
    }
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

      <UsageMeter />

      <button
        type="button"
        className="btn btn-icon search-btn"
        onClick={onOpenSearch}
        title="Search sessions (Ctrl/Cmd+Shift+F)"
        aria-label="Search sessions"
      >
        <span aria-hidden="true">⌕</span>
      </button>

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

      {pending !== null && settings && (
        <PromptModal
          title="New session"
          label="What are you working on? (names the tab + git branch)"
          placeholder="e.g. fix login redirect"
          confirmLabel="Start"
          showWorktree={pending.showWorktree}
          onSubmit={(value, useWorktreeChecked) => {
            const { cwd, showWorktree } = pending
            setPending(null)
            // mode "ask" → the checkbox; otherwise mode decides.
            const useWorktree = showWorktree
              ? useWorktreeChecked
              : settings.worktreeMode === 'always'
            void newSession(cwd, value.trim(), useWorktree)
          }}
          onSkip={() => {
            const { cwd } = pending
            setPending(null)
            // Plain session: no task name; worktree only if the mode is "always".
            void newSession(cwd, '', settings.worktreeMode === 'always')
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </header>
  )
}
