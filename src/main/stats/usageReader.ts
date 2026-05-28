// Reads per-session token usage from Claude Code's own transcript files.
//
// Claude writes one JSONL transcript per session under
// ~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl. Each assistant message
// carries a `message.usage` block (input/output/cache token counts) and the
// model. We locate the session's transcript by its working directory (which the
// main process knows) and derive:
//   - contextTokens: the LAST message's input + cache tokens = current context fill
//   - totalOutputTokens: cumulative output tokens generated this session
// We report the LIVE context fill for the session (how full the window is right
// now), not cumulative totals. This is Claude-specific; other agents report none.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CLAUDE_PROJECTS = join(homedir(), '.claude', 'projects')

// Claude derives the project-dir name from the cwd by replacing every '/' and
// '.' with '-' (e.g. /home/u/repo.x -> -home-u-repo-x).
function encodeCwd(cwd: string): string {
  return cwd.replace(/[/.]/g, '-')
}

/** Newest top-level *.jsonl transcript in the cwd's project dir, or null. */
export function findTranscript(cwd: string): string | null {
  const dir = join(CLAUDE_PROJECTS, encodeCwd(cwd))
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null // no project dir yet (session hasn't written a transcript)
  }
  let newest: { path: string; mtime: number } | null = null
  for (const name of entries) {
    if (!name.endsWith('.jsonl')) continue
    const path = join(dir, name)
    try {
      const s = statSync(path)
      if (s.isFile() && (!newest || s.mtimeMs > newest.mtime)) {
        newest = { path, mtime: s.mtimeMs }
      }
    } catch {
      // entry vanished between readdir and stat — ignore
    }
  }
  return newest?.path ?? null
}

// Context-window size in tokens. The transcript model string ("claude-opus-4-8")
// doesn't reveal whether the 1M-context beta is active, so we infer the tier from
// the observed fill: anything past the 200k standard window must be a 1M session.
function contextWindowFor(contextTokens: number): number {
  return contextTokens > 200_000 ? 1_000_000 : 200_000
}

export interface UsageStats {
  contextTokens: number
  contextWindow: number
  model: string | null
}

/** Parse the transcript for the given cwd. Returns null if none exists yet. */
export function readUsage(cwd: string): UsageStats | null {
  const path = findTranscript(cwd)
  if (!path) return null

  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return null
  }

  let contextTokens = 0
  let model: string | null = null

  for (const line of text.split('\n')) {
    // Cheap pre-filter: only assistant messages carry a usage block.
    if (!line.includes('"usage"')) continue
    let obj: { message?: { usage?: Record<string, number>; model?: string } }
    try {
      obj = JSON.parse(line)
    } catch {
      continue // partial last line during a write — skip
    }
    const u = obj.message?.usage
    if (!u) continue
    // Current context occupancy = the most recent message's prompt-side tokens.
    const ctx =
      (u.input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0) +
      (u.cache_creation_input_tokens ?? 0)
    if (ctx > 0) contextTokens = ctx // last (newest) line wins
    if (obj.message?.model) model = obj.message.model
  }

  return {
    contextTokens,
    contextWindow: contextWindowFor(contextTokens),
    model
  }
}
