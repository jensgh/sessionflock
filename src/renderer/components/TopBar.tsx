import { useState } from 'react'
import { useSettings } from '../settings/SettingsContext'
import { createSession } from '../terminal/useTerminal'
import { SettingsModal } from './SettingsModal'

/** Top bar: New Session (left) and Settings (right). */
export function TopBar(): JSX.Element {
  const { settings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const onNewSession = async (): Promise<void> => {
    if (!settings || creating) return
    setCreating(true)
    try {
      // New sessions open in the configured default home folder.
      await createSession({
        cwd: settings.defaultHomeFolder,
        theme: settings.theme,
        activate: true
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <header className="top-bar">
      <button
        type="button"
        className="btn btn-primary new-session-btn"
        onClick={() => void onNewSession()}
        disabled={!settings || creating}
        title="Start a new Claude session"
      >
        <span aria-hidden="true">＋</span> New Session
      </button>

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
