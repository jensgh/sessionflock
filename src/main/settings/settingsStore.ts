// Persisted application settings, stored as JSON in the app's userData dir.
// Reads are tolerant (missing/corrupt -> defaults); writes are atomic
// (tmp file + rename) so a crash mid-write can't leave a truncated file.

import { app } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/ipc-types'

let cache: AppSettings | undefined

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function defaults(): AppSettings {
  return { ...DEFAULT_SETTINGS, defaultHomeFolder: app.getPath('home') }
}

/**
 * Coerce arbitrary parsed JSON into a valid AppSettings. Unknown/older shapes
 * fall back to defaults per-field. `version` drives any future migrations.
 */
function migrate(raw: unknown): AppSettings {
  const base = defaults()
  if (!raw || typeof raw !== 'object') return base

  const r = raw as Record<string, unknown>
  const out: AppSettings = { ...base }

  if (typeof r.defaultHomeFolder === 'string' && r.defaultHomeFolder.length > 0) {
    out.defaultHomeFolder = r.defaultHomeFolder
  }
  if (r.theme === 'system' || r.theme === 'light' || r.theme === 'dark') {
    out.theme = r.theme
  }
  if (typeof r.needsInputIdleMs === 'number' && Number.isFinite(r.needsInputIdleMs)) {
    out.needsInputIdleMs = r.needsInputIdleMs
  }
  if (typeof r.defaultAgent === 'string' && r.defaultAgent.length > 0) {
    out.defaultAgent = r.defaultAgent
  }
  if (r.worktreeMode === 'always' || r.worktreeMode === 'never' || r.worktreeMode === 'ask') {
    out.worktreeMode = r.worktreeMode
  } else if (typeof r.gitWorktreeByDefault === 'boolean') {
    // Migrate the old boolean setting.
    out.worktreeMode = r.gitWorktreeByDefault ? 'always' : 'never'
  }
  if (typeof r.askOnNewSession === 'boolean') {
    out.askOnNewSession = r.askOnNewSession
  }
  if (typeof r.desktopNotifications === 'boolean') {
    out.desktopNotifications = r.desktopNotifications
  }
  if (typeof r.claudePath === 'string' || r.claudePath === null) {
    out.claudePath = r.claudePath
  }
  // version is fixed at 1 for now; out.version already equals base.version.
  return out
}

/** Read settings (cached). Missing or corrupt file -> defaults. */
export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    const text = readFileSync(settingsPath(), 'utf8')
    cache = migrate(JSON.parse(text))
  } catch {
    cache = defaults()
  }
  return cache
}

/** Merge a patch into current settings, persist atomically, return the result. */
export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const merged: AppSettings = { ...getSettings(), ...patch, version: 1 }
  cache = merged

  const target = settingsPath()
  const tmp = target + '.tmp'
  try {
    writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8')
    renameSync(tmp, target)
  } catch (err) {
    // Keep the in-memory cache updated even if persistence failed, so the
    // running session reflects the user's choice; just log the write error.
    console.error('Failed to persist settings:', err)
  }
  return merged
}
