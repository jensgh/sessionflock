// Reads per-session token usage from Claude Code's own transcript file.
//
// Each Claude session writes a JSONL transcript whose path it reports to our
// hooks on stdin (session_id + transcript_path). The PTY manager captures that
// payload into a per-session meta file ($SFLOCK_META_FILE); here we read the
// transcript_path from it and parse THAT exact transcript — so a tab always
// reflects its own session, never another session that happens to share the cwd.
//
// We report the LIVE context fill (how full the window is right now = the most
// recent message's prompt-side tokens), not cumulative totals. Claude-specific;
// other agents report no stats.

import { readFileSync } from 'node:fs'

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

/** Read the transcript_path a session's hooks captured into its meta file. */
function transcriptPathFromMeta(metaFile: string): string | null {
  let raw: string
  try {
    raw = readFileSync(metaFile, 'utf8')
  } catch {
    return null // no hook has fired yet — session hasn't reported its transcript
  }
  try {
    const meta = JSON.parse(raw) as { transcript_path?: unknown }
    return typeof meta.transcript_path === 'string' && meta.transcript_path.length > 0
      ? meta.transcript_path
      : null
  } catch {
    return null
  }
}

/** Usage for the session whose hooks wrote `metaFile`. Null until one has fired. */
export function readUsage(metaFile: string): UsageStats | null {
  const transcript = transcriptPathFromMeta(metaFile)
  if (!transcript) return null

  let text: string
  try {
    text = readFileSync(transcript, 'utf8')
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

/**
 * The first human prompt in the session's transcript (for auto-naming), or null
 * if none yet. Returns the first `user` message whose content is plain text —
 * i.e. a typed prompt, not a tool result.
 */
export function readFirstPrompt(metaFile: string): string | null {
  const transcript = transcriptPathFromMeta(metaFile)
  if (!transcript) return null

  let text: string
  try {
    text = readFileSync(transcript, 'utf8')
  } catch {
    return null
  }

  for (const line of text.split('\n')) {
    if (!line.includes('"user"')) continue
    let obj: { type?: string; isMeta?: boolean; message?: { content?: unknown } }
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    if (obj.type !== 'user' || obj.isMeta) continue
    const content = obj.message?.content
    // A typed prompt is a plain string; arrays are tool results / rich blocks.
    if (typeof content === 'string') {
      const trimmed = content.trim()
      if (trimmed) return trimmed
    }
  }
  return null
}
