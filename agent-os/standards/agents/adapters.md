# Agent Adapters

The app is **agent-agnostic**. The PTY manager knows nothing about Claude — it drives
everything through the `AgentDefinition` interface (`main/agents/types.ts`).

```ts
interface AgentDefinition {
  id: string                       // matches the id in shared/agents.ts
  label: string
  buildEnv(): NodeJS.ProcessEnv    // PATH, TERM, locale, …
  resolveLaunch(opts: { explicitPath?: string | null }): AgentLaunch  // { bin, args }
}
```

## Adding an agent

1. Implement an `AgentDefinition` in a sibling file under `main/agents/`.
2. Register it in `main/agents/index.ts` (`REGISTRY`).
3. Add its `{ id, label }` to `shared/agents.ts` so it appears in the Settings dropdown.

`getAgent(id)` falls back to the Claude adapter for an unknown id.

## Adapter responsibilities

- **PATH:** GUI apps don't inherit the login-shell PATH. Resolve it by running the
  login shell once (`$SHELL -ilc 'printf %s "$PATH"'`), merge with `process.env.PATH`
  (dedup, order-preserving), then probe common install dirs. Memoize the result.
- **`resolveLaunch` throws** a clear, user-facing `Error` when the binary isn't found;
  the PTY manager converts it to an `{ ok: false, message }` IPC result.
- **Attention hooks:** configure the agent to append a marker line to
  `$SFLOCK_EVENT_FILE` (set per-session by the PTY manager) — never write to the tty
  (hooks run without a controlling terminal). End hook commands with `|| true`.
- Inject per-session agent config inline (Claude: `--settings <json>`); merge with,
  never overwrite, the user's own config.
