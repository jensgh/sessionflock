// Persists the renderer's session snapshot (tab list, names, active tab, order)
// to JSON in userData. Debouncing of saves lives in the renderer; the main
// process just durably writes whatever it's handed. Atomic writes (tmp +
// rename) guard against truncation on crash.

import { app } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EMPTY_SNAPSHOT,
  PersistedSession,
  SessionSnapshot,
  SessionId
} from '@shared/ipc-types'

function snapshotPath(): string {
  return join(app.getPath('userData'), 'sessions.json')
}

/** Defensively coerce parsed JSON into a SessionSnapshot. */
function normalize(raw: unknown): SessionSnapshot {
  if (!raw || typeof raw !== 'object') return EMPTY_SNAPSHOT
  const r = raw as Record<string, unknown>

  const sessions: PersistedSession[] = Array.isArray(r.sessions)
    ? r.sessions.filter(isPersistedSession)
    : []

  const activeId: SessionId | null =
    typeof r.activeId === 'string' ? r.activeId : null

  return { version: 1, activeId, sessions }
}

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.cwd === 'string' &&
    typeof v.name === 'string' &&
    typeof v.isManualName === 'boolean' &&
    typeof v.order === 'number'
  )
}

/** Load the persisted snapshot. Missing or corrupt -> EMPTY_SNAPSHOT. */
export function loadSnapshot(): SessionSnapshot {
  try {
    const text = readFileSync(snapshotPath(), 'utf8')
    return normalize(JSON.parse(text))
  } catch {
    return EMPTY_SNAPSHOT
  }
}

/** Atomically persist the snapshot. */
export function saveSnapshot(s: SessionSnapshot): void {
  const target = snapshotPath()
  const tmp = target + '.tmp'
  try {
    writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf8')
    renameSync(tmp, target)
  } catch (err) {
    console.error('Failed to persist sessions snapshot:', err)
  }
}
