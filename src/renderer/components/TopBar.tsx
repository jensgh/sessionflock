import { useState } from 'react'
import { useSettings } from '../settings/SettingsContext'
import { createSession } from '../terminal/useTerminal'
import { SettingsModal } from './SettingsModal'

/** Top bar: New Session split-button (left) and Settings (right). */
export function TopBar(): JSX.Element {
  const { settings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const newSession = async (cwd: string): Promise<void> => {
    if (!settings || creating) return
    setCreating(true)
    try {
      await createSession({ cwd, theme: settings.theme, activate: true })
    } finally {
      setCreating(false)
    }
  }

  // Default: open in the configured home folder.
  const onNewSession = (): void => {
    if (settings) void newSession(settings.defaultHomeFolder)
  }

  // Ad-hoc: pick a folder for this session only, overriding the default.
  const onNewSessionInFolder = async (): Promise<void> => {
    if (!settings) return
    const picked = await window.api.pickFolder(settings.defaultHomeFolder)
    if (picked) void newSession(picked)
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
    </header>
  )
}
