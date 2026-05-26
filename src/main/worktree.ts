// Optional git-worktree isolation. When enabled and a session's folder is a git
// repo, we spin up a fresh worktree (a clean checkout of HEAD on a new branch)
// and run the agent there, so multiple sessions can work on the same repo in
// parallel without colliding. Changes live on the new branch; nothing is removed
// automatically, so an agent's work is never lost on close.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { app } from 'electron'

function git(args: string[], cwd?: string): string {
  return execFileSync('git', cwd ? ['-C', cwd, ...args] : args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim()
}

export function isGitRepo(dir: string): boolean {
  try {
    return git(['rev-parse', '--is-inside-work-tree'], dir) === 'true'
  } catch {
    return false
  }
}

export interface SessionCwd {
  /** Directory the agent should actually run in. */
  cwd: string
  /** The created worktree path, or null if none was created. */
  worktree: string | null
  /** The new branch name, or null. */
  branch: string | null
}

/**
 * Resolve where a session should run. If `useWorktree` and `requestedCwd` is a
 * git repo, create a fresh worktree and return it; on any failure (or not a
 * repo), fall back to running directly in `requestedCwd`.
 */
export function prepareSessionCwd(requestedCwd: string, useWorktree: boolean): SessionCwd {
  if (!useWorktree || !isGitRepo(requestedCwd)) {
    return { cwd: requestedCwd, worktree: null, branch: null }
  }
  try {
    const repoRoot = git(['rev-parse', '--show-toplevel'], requestedCwd)
    const token = randomUUID().slice(0, 8)
    const branch = `sessionflock/${token}`
    const base = join(app.getPath('userData'), 'worktrees')
    mkdirSync(base, { recursive: true })
    const wtPath = join(base, `${basename(repoRoot)}-${token}`)
    // -b <branch> from HEAD => a clean working tree with no uncommitted changes.
    git(['worktree', 'add', '-b', branch, wtPath, 'HEAD'], repoRoot)
    return { cwd: wtPath, worktree: wtPath, branch }
  } catch (err) {
    console.error(
      '[worktree] could not create worktree, using folder directly:',
      err instanceof Error ? err.message : String(err)
    )
    return { cwd: requestedCwd, worktree: null, branch: null }
  }
}
