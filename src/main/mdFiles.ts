// Lists the markdown files under a session's folder for the optional MD-files
// panel. A pragmatic "what docs are in this project" view — it walks the folder
// (skipping heavy/vendor dirs), bounded in depth and count so a huge tree can't
// stall the scan.

import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { MdFile } from '@shared/ipc-types'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  'release',
  '.next',
  '.cache',
  'vendor',
  'target',
  'coverage'
])
const MAX_DEPTH = 6
const MAX_FILES = 500

function isMarkdown(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

/** Markdown files under `root`, relative + absolute, sorted by relative path. */
export function listMarkdown(root: string): MdFile[] {
  const out: MdFile[] = []

  const walk = (dir: string, depth: number): void => {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // unreadable dir — skip
    }
    for (const entry of entries) {
      if (out.length >= MAX_FILES) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        walk(full, depth + 1)
      } else if (entry.isFile() && isMarkdown(entry.name)) {
        out.push({ rel: relative(root, full), abs: full })
      }
    }
  }

  walk(root, 0)
  out.sort((a, b) => a.rel.localeCompare(b.rel))
  return out
}
