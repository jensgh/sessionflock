# Tech Stack

Cross-platform desktop application built on the proven "terminal-in-a-GUI"
pattern (as used by VS Code's integrated terminal, Hyper, and Tabby):
xterm.js for rendering paired with a PTY backend for spawning real processes.

## Frontend

- **React** — UI for the workspace, tab list, session controls, and settings.
- **xterm.js** — renders each session's interactive terminal inside the Electron
  renderer process.

## Backend

- **Electron (main process, Node.js)** — application shell, window management, and
  bridge between the UI and the system.
- **node-pty** — spawns pseudo-terminals that run agent processes; supports
  Linux/macOS now and Windows (ConPTY) for the Phase 2 goal.
- **Agent adapters** — an agent-agnostic registry (`src/main/agents/`) where each
  agent implements how to locate its binary, build its launch args/env, and
  surface attention signals. Claude Code ships as an adapter (it uses Claude's
  `--settings` hooks, which append markers to a per-session event file the app
  watches). New agents are added as adapters; a setting selects the active one.
- **Git worktree management** — created/managed via the `git` CLI (optionally
  wrapped with a helper like simple-git) to provide per-session worktree
  isolation.

## Database

No dedicated database for the MVP. Application config and UI state are kept in
local JSON (in Electron's userData dir). Where an agent has its own native
session storage (e.g. Claude Code's `~/.claude`), the relevant agent adapter
reads it directly. A local store such as SQLite can be introduced later if
search/indexing (Phase 2) requires it.

## Other

- **Electron Builder** (or electron-forge) — cross-platform packaging and
  distribution (Linux + macOS for MVP; Windows in Phase 2).
- **Node.js** runtime.
