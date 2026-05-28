A cross-platform desktop workspace for running and managing many **terminal AI-agent sessions** at once — each in its own embedded terminal tab. Agent-agnostic, with **Claude Code** supported out of the box.

## New in 0.2

- **Windows installer (beta)** — a `.exe` (NSIS) is now produced. The core workspace
  works on Windows; hook-driven features (precise done/ask dot, per-session token stats,
  plan-usage meter, auto-name) are not available on Windows yet.
- **Clickable links** — URLs printed in the terminal open in your default browser.
- **Agent icon per tab** — each tab shows the agent it's running.
- **Per-session usage** — each tab shows its context-window fill; a top-bar meter shows the Claude icon + your **5-hour plan usage**, expandable to **5h / 7-day** plan windows plus the active session's model and context.
- **Session panels** *(right-edge tabs)* — see, per session, the **markdown files it read**, the **MCP servers it used**, and the **skills it ran** (derived from the session itself).
- **Search across sessions** — `Ctrl/Cmd+Shift+F` to search session names and terminal output; click a result to jump.
- **Desktop notifications** — when a backgrounded session needs you or finishes (only while the app is unfocused); click to jump to it. Toggle in Settings.
- **Auto-name sessions** — unnamed tabs are titled from your first prompt automatically. Toggle in Settings.
- **Coloured "needs you" dot** — green when a turn finished, amber when it's waiting for your input.
- **Smoother light theme.**

## Features

- **Multi-terminal workspace** — sessions as tabs down the left; each is a real embedded terminal (xterm.js + node-pty).
- **Agent selection** — choose which agent new sessions launch.
- **Git worktree isolation** — **Always / Never / Ask each time**; run a session in a fresh git worktree on its own branch so parallel sessions don't collide.
- **Ask on new session** *(optional)* — name the task; it names the tab and the git branch. The new-session prompt has a **Skip** button to start right away.
- **"Needs you" indicator** — a tab dot when a backgrounded session is waiting for you (driven by the agent's lifecycle hooks / terminal bell).
- **Copy / paste** — `Ctrl+Shift+C` / `Cmd+C` and `Ctrl+Shift+V` / `Cmd+V`, plus a right-click menu.
- **Auto tab naming** with manual rename, and **session persistence** (open tabs reopen on restart).
- **Close with confirmation.**
- **Auto-update** from GitHub Releases (Linux/Windows; macOS pending code-signing).
- **Light / dark / system theme.**

## Install

- **Linux** — `.AppImage` (mark executable and run) or `.deb`.
- **Windows** — `.exe` (NSIS) *(beta — see note above)*. Unsigned, so SmartScreen may warn: **More info → Run anyway**.
- **macOS (Apple Silicon / M1+)** — `.dmg`. Unsigned for now, so on first launch use right-click → **Open**.

Requires the agent's CLI on your PATH — for Claude Code, the `claude` binary (auto-detected; path configurable in Settings).
