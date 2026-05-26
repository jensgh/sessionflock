// An agent adapter describes how to launch one kind of terminal agent (Claude
// Code, and others later) and the environment it should run in. The PTY manager
// is agent-agnostic and drives everything through this interface.

export interface AgentLaunch {
  /** Absolute path to the executable to spawn. */
  bin: string
  /** Arguments passed to it. */
  args: string[]
}

export interface AgentDefinition {
  /** Stable id, matches the id in shared/agents.ts (e.g. 'claude'). */
  id: string
  /** Human-readable label for the UI. */
  label: string
  /** Build the base spawn environment (PATH, TERM, locale, …). */
  buildEnv(): NodeJS.ProcessEnv
  /**
   * Resolve the concrete executable + args for a session. Throws a clear,
   * user-facing Error if the agent isn't installed/locatable.
   */
  resolveLaunch(opts: { explicitPath?: string | null }): AgentLaunch
}
