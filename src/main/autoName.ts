// Derives a short session name from the user's first prompt by asking the agent
// itself, headless (`claude -p`). One-shot, best-effort: returns null on any
// failure so the caller just keeps the existing name. The CLI binary + env are
// resolved through the same agent adapter the PTYs use.

import { execFile } from 'node:child_process'
import { getAgent } from './agents/index.js'
import { getSettings } from './settings/settingsStore.js'

const TIMEOUT_MS = 25_000
const MAX_PROMPT_CHARS = 2000
const MAX_NAME_CHARS = 48

const INSTRUCTION =
  'Reply with ONLY a short tab title (2 to 5 words, Title Case, no quotes, no ' +
  'trailing punctuation, no explanation) that summarizes what this coding task ' +
  'is about. Task:\n\n'

/** Tidy the model's reply into a single short title, or null if unusable. */
function cleanName(stdout: string): string | null {
  const firstLine = stdout.trim().split('\n')[0]?.trim() ?? ''
  // Strip wrapping quotes/backticks and any trailing punctuation.
  const name = firstLine
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!,;:]+$/, '')
    .trim()
    .slice(0, MAX_NAME_CHARS)
  return name.length > 0 ? name : null
}

/** Summarize `prompt` into a short session name via a headless agent call. */
export function deriveSessionName(prompt: string): Promise<string | null> {
  const trimmed = (prompt ?? '').trim()
  if (!trimmed) return Promise.resolve(null)

  const settings = getSettings()
  let bin: string
  let env: NodeJS.ProcessEnv
  try {
    bin = getAgent(settings.defaultAgent).resolveLaunch({ explicitPath: settings.claudePath }).bin
    env = getAgent(settings.defaultAgent).buildEnv()
  } catch {
    return Promise.resolve(null) // agent not locatable
  }

  const instruction = INSTRUCTION + trimmed.slice(0, MAX_PROMPT_CHARS)

  return new Promise((resolve) => {
    execFile(
      bin,
      ['-p', instruction],
      { env: env as NodeJS.ProcessEnv, timeout: TIMEOUT_MS, maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err) {
          resolve(null)
          return
        }
        resolve(cleanName(stdout))
      }
    )
  })
}
