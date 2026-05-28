// Claude Code agent adapter. Locates the `claude` binary and builds its launch.
// GUI apps on macOS/Linux inherit a minimal PATH (not the user's login-shell
// PATH), so we resolve the real interactive PATH by running the login shell once.
// Results are memoized — only worth doing once per process.
//
// Windows: there's no POSIX login shell, the PATH separator differs, and the
// binary is a `claude.cmd`/`.exe` shim. The lifecycle hooks (POSIX shell) are
// deferred on Windows, so we launch plain `claude` there — see resolveLaunch.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import type { AgentDefinition, AgentLaunch } from './types.js'

const isWindows = process.platform === 'win32'

let cachedLoginPath: string | undefined
let cachedClaude: { explicit: string | null | undefined; result: string | null } | undefined

/**
 * Run the user's login shell once to capture the interactive PATH. Falls back
 * to `process.env.PATH` if the shell invocation fails. Memoized.
 */
function resolveLoginShellPath(): string {
  if (cachedLoginPath !== undefined) return cachedLoginPath

  // Windows has no POSIX login shell — the process PATH is what we have.
  if (isWindows) {
    cachedLoginPath = process.env.PATH || ''
    return cachedLoginPath
  }

  const shell = process.env.SHELL || '/bin/bash'
  try {
    // -i interactive, -l login, -c command: sources the user's rc/profile files
    // so PATH matches what they'd see in a real terminal.
    const out = execFileSync(shell, ['-ilc', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const trimmed = out.trim()
    cachedLoginPath = trimmed.length > 0 ? trimmed : process.env.PATH || ''
  } catch {
    cachedLoginPath = process.env.PATH || ''
  }
  return cachedLoginPath
}

/** Merge the login-shell PATH with the current process PATH (dedup, order-preserving). */
function mergedPath(): string {
  const sep = delimiter // ':' on POSIX, ';' on Windows
  const parts: string[] = []
  const seen = new Set<string>()
  for (const chunk of [resolveLoginShellPath(), process.env.PATH || '']) {
    for (const p of chunk.split(sep)) {
      if (p && !seen.has(p)) {
        seen.add(p)
        parts.push(p)
      }
    }
  }
  return parts.join(sep)
}

/** Search a PATH string for the first existing executable among `names`. */
function searchPathFor(names: string[], pathStr: string): string | null {
  for (const dir of pathStr.split(delimiter)) {
    if (!dir) continue
    for (const name of names) {
      const candidate = join(dir, name)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/**
 * Find the `claude` binary. Prefers an explicit path, then the login-shell PATH,
 * then common install locations. Returns an absolute path or null. Memoized.
 */
function findClaude(explicit?: string | null): string | null {
  if (cachedClaude && cachedClaude.explicit === explicit) return cachedClaude.result

  let result: string | null = null
  if (explicit && existsSync(explicit)) {
    result = explicit
  } else {
    const names = isWindows
      ? ['claude.cmd', 'claude.exe', 'claude.bat', 'claude']
      : ['claude']
    result = searchPathFor(names, mergedPath())
    if (!result) {
      const home = homedir()
      const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
      const probes = isWindows
        ? [join(appData, 'npm', 'claude.cmd'), join(appData, 'npm', 'claude.exe')]
        : [
            join(home, '.local', 'bin', 'claude'),
            join(home, '.claude', 'local', 'claude'),
            '/usr/local/bin/claude',
            '/opt/homebrew/bin/claude'
          ]
      for (const p of probes) {
        if (existsSync(p)) {
          result = p
          break
        }
      }
    }
  }

  cachedClaude = { explicit, result }
  return result
}

/**
 * Base spawn env: real login-shell PATH, a 256-color truecolor terminal, and a
 * sane locale fallback so the CLI renders correctly. (The PTY manager adds the
 * per-session SFLOCK_EVENT_FILE var on top of this.)
 */
function buildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  env.PATH = mergedPath()
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  if (!env.LANG) env.LANG = 'en_US.UTF-8'
  return env
}

// Per-session Claude Code settings, injected via `--settings` inline JSON. This
// MERGES with (does not replace) the user's own settings and never touches their
// global ~/.claude/settings.json — scoped to the process we spawn.
//
// The hooks do two jobs:
//   - Attention: `Stop` (turn ended) and `Notification` APPEND a marker line to
//     the per-session event file ($SFLOCK_EVENT_FILE), which the main process
//     watches to light the "needs you" dot.
//   - Stats: every hook gets the session's JSON payload (incl. transcript_path)
//     on stdin; we capture it to $SFLOCK_META_FILE so the host can read THIS
//     session's transcript for token usage. `SessionStart` captures it up front.
// We deliberately do NOT write to the terminal: Claude runs hooks without a
// controlling terminal, so `>/dev/tty` fails and a failing hook can block the
// operation. Writing to a file always succeeds; `|| true` guarantees exit 0.

// Capture the hook's stdin JSON (transcript_path + session_id) for the host.
const captureMeta = `cat > "$SFLOCK_META_FILE" 2>/dev/null`
const appendMarker = (kind: string): string =>
  `printf '${kind}\\n' >> "$SFLOCK_EVENT_FILE" 2>/dev/null`

const captureOnly = {
  hooks: [{ type: 'command', command: `${captureMeta} || true` }]
}
const captureAndMark = (
  kind: string
): { hooks: Array<{ type: string; command: string }> } => ({
  hooks: [{ type: 'command', command: `( ${captureMeta}; ${appendMarker(kind)} ) 2>/dev/null || true` }]
})

const hooks: Record<string, unknown> = {
  SessionStart: [captureOnly],
  Stop: [captureAndMark('done')],
  Notification: [captureAndMark('ask')]
}

// Diagnostic probes (SFLOCK_DEBUG=1): emit markers on extra lifecycle events so the
// main-process log can show which hooks actually fire on a given Claude version.
if (process.env.SFLOCK_DEBUG === '1') {
  const probe = (kind: string): { hooks: Array<{ type: string; command: string }> } => ({
    hooks: [{ type: 'command', command: `${appendMarker(kind)} || true` }]
  })
  hooks.UserPromptSubmit = [probe('prompt')]
  hooks.PreToolUse = [probe('pretool')]
  hooks.SubagentStop = [probe('subdone')]
}

const SESSION_SETTINGS = JSON.stringify({
  preferredNotifChannel: 'terminal_bell',
  hooks
})

export const claudeAgent: AgentDefinition = {
  id: 'claude',
  label: 'Claude Code',
  buildEnv,
  resolveLaunch: ({ explicitPath }): AgentLaunch => {
    const bin = findClaude(explicitPath)
    if (!bin) {
      throw new Error('Could not find the `claude` binary. Set its path in Settings.')
    }
    if (isWindows) {
      // Hooks are POSIX-shell and deferred on Windows, so launch plain `claude`
      // (the terminal still works; precise dot/stats/auto-name are off). ConPTY
      // can't exec a .cmd/.bat shim directly — route those through cmd.exe.
      if (/\.(cmd|bat)$/i.test(bin)) {
        return { bin: process.env.ComSpec || 'cmd.exe', args: ['/c', bin] }
      }
      return { bin, args: [] }
    }
    return { bin, args: ['--settings', SESSION_SETTINGS] }
  }
}
