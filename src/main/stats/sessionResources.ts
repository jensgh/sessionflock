// Extracts what a session actually USED from its transcript: the markdown files
// it read/edited, the MCP servers whose tools it invoked, and the skills it ran.
// Per-session and grounded in the transcript — not a folder scan or a global list.

import { readFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import type { MdFile, SessionResources } from '@shared/ipc-types'
import { transcriptPathFromMeta } from './usageReader.js'

const EMPTY: SessionResources = { mdFiles: [], mcpServers: [], skills: [] }

function isMarkdown(p: string): boolean {
  const lower = p.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

/** "claude_ai_Asana" -> "Asana"; "some_local_server" -> "some local server". */
function prettyServer(segment: string): string {
  return segment.replace(/^claude_ai_/, '').replace(/_/g, ' ').trim() || segment
}

/** Resources the session (identified by its meta file) has used so far. */
export function readSessionResources(metaFile: string): SessionResources {
  const transcript = transcriptPathFromMeta(metaFile)
  if (!transcript) return EMPTY

  let text: string
  try {
    text = readFileSync(transcript, 'utf8')
  } catch {
    return EMPTY
  }

  const mdAbs = new Set<string>()
  const servers = new Set<string>()
  const skills = new Set<string>()
  let cwd = ''

  for (const line of text.split('\n')) {
    if (!line.includes('"tool_use"')) continue
    let obj: { cwd?: string; message?: { content?: unknown } }
    try {
      obj = JSON.parse(line)
    } catch {
      continue
    }
    if (!cwd && typeof obj.cwd === 'string') cwd = obj.cwd
    const content = obj.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!block || typeof block !== 'object' || block.type !== 'tool_use') continue
      const name: string = block.name ?? ''
      const input = (block.input ?? {}) as Record<string, unknown>
      if (name === 'Read' || name === 'Edit' || name === 'Write' || name === 'NotebookEdit') {
        const p = (input.file_path ?? input.notebook_path) as string | undefined
        if (typeof p === 'string' && isMarkdown(p)) mdAbs.add(p)
      } else if (name.startsWith('mcp__')) {
        const seg = name.split('__')[1]
        if (seg) servers.add(prettyServer(seg))
      } else if (name === 'Skill') {
        const s = (input.skill ?? input.command ?? input.name) as string | undefined
        if (typeof s === 'string' && s) skills.add(s)
      }
    }
  }

  const mdFiles: MdFile[] = [...mdAbs].sort().map((abs) => {
    let rel = cwd ? relative(cwd, abs) : abs
    if (!rel || rel.startsWith('..')) rel = basename(abs)
    return { rel, abs }
  })

  return {
    mdFiles,
    mcpServers: [...servers].sort(),
    skills: [...skills].sort()
  }
}
