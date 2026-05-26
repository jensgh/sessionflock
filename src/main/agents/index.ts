// Registry of available agent adapters. To add an agent: implement an
// AgentDefinition in a sibling file, register it here, and add its id/label to
// shared/agents.ts so it appears in the Settings dropdown.

import { claudeAgent } from './claude.js'
import type { AgentDefinition } from './types.js'

const REGISTRY: Record<string, AgentDefinition> = {
  [claudeAgent.id]: claudeAgent
}

/** Look up an agent by id, falling back to Claude (the default) if unknown. */
export function getAgent(id: string | undefined | null): AgentDefinition {
  return (id && REGISTRY[id]) || claudeAgent
}
