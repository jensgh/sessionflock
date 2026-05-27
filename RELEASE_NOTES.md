A cross-platform desktop workspace for running and managing many **terminal AI-agent sessions** at once — each in its own embedded terminal tab. Agent-agnostic, with **Claude Code** supported out of the box.

## Features

- **Multi-terminal workspace** — sessions as tabs down the left; each is a real embedded terminal (xterm.js + node-pty).
- **Agent selection** — choose which agent new sessions launch.
- **Git worktree isolation** *(optional)* — run each session in a fresh git worktree on its own branch so parallel sessions don't collide.
- **Ask on new session** *(optional)* — name the task; it names the tab and the git branch.
- **"Needs you" indicator** — a tab dot when a backgrounded session is waiting for you (driven by the agent's lifecycle hooks / terminal bell).
- **Copy / paste** — `Ctrl+Shift+C` / `Cmd+C` and `Ctrl+Shift+V` / `Cmd+V`, plus a right-click menu.
- **Auto tab naming** with manual rename, and **session persistence** (open tabs reopen on restart).
- **Close with confirmation.**
- **Auto-update** from GitHub Releases (Linux/Windows; macOS pending code-signing).
- **Light / dark / system theme.**

## Install

- **Linux** — `.AppImage` (mark executable and run) or `.deb`.
- **macOS (Apple Silicon / M1+)** — `.dmg`. Unsigned for now, so on first launch use right-click → **Open**.

Requires the agent's CLI on your PATH — for Claude Code, the `claude` binary (auto-detected; path configurable in Settings).
