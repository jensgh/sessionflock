// The terminal agents Sessionflock can launch. The app is agent-agnostic; agents
// are added as adapters. Adding one means appending to this list and adding a
// launcher under src/main/agents/.

export interface AgentInfo {
  id: string
  label: string
}

export const AGENTS: readonly AgentInfo[] = [{ id: 'claude', label: 'Claude Code' }] as const

export const DEFAULT_AGENT_ID = 'claude'
